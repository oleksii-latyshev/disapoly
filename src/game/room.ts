/**
 * Room model and authoritative room reducer (Stage 1 — networking).
 *
 * This is the single source of truth for a multiplayer room: lobby membership
 * plus the in-progress game. It is pure and transport-agnostic — the PartyKit
 * server is a thin wrapper that feeds client messages in and broadcasts the
 * resulting state out. Keeping it here (in the alias-free game core) lets the
 * same logic bundle on the server without pulling in any React/UI code.
 */

import { PLAYER_COLORS, PLAYER_EMOJIS } from "./board.config"
import { gameReducer } from "./reducer"
import { createInitialState, DEFAULT_SETTINGS } from "./state"
import type { GameAction, GameSettings, GameState } from "./types"

const MAX_MEMBERS = PLAYER_COLORS.length // 8
const MIN_MEMBERS = 2

/** How long a player may stay disconnected mid-match before being removed. */
export const AUTO_BANKRUPT_MS = 5 * 60_000

export type RoomMember = {
  /** playerId — client-generated, persisted in localStorage for reconnect. */
  id: string
  nickname: string
  color: string
  /** Emoji avatar (from PLAYER_EMOJIS); unique within the room. */
  emoji: string
  isHost: boolean
  connected: boolean
  /** Epoch ms of the last disconnect; null while connected. */
  disconnectedAt: number | null
}

export type RoomState = {
  roomId: string
  phase: "lobby" | "in-game"
  members: RoomMember[]
  game: GameState | null
  /**
   * When set, the disconnected current player's turn will be auto-skipped at
   * this epoch-ms deadline (the server owns the timestamp + the DO alarm). Null
   * when nobody is stalling. Clients render a countdown from it.
   */
  autoSkipAt: number | null
  /** playerIds removed by the host — barred from rejoining this room. */
  kickedIds: string[]
}

/** Emoji reactions players can fling during a live game. */
export const REACTIONS: readonly string[] = ["👍", "😂", "😮", "🔥", "😢", "🎉"]

/** Client → server intents. */
export type ClientMessage =
  | { type: "join"; playerId: string; nickname: string; emoji?: string }
  | { type: "start"; settings?: Partial<GameSettings> } // host only; settings = match rules
  | { type: "action"; action: GameAction }
  | { type: "reset" }
  | { type: "skip" } // skip a disconnected player's turn
  | { type: "rename"; nickname: string } // change the sender's nickname
  | { type: "avatar"; emoji: string } // change the sender's emoji avatar
  | { type: "kick"; playerId: string } // host removes a member (lobby only)
  | { type: "reaction"; emoji: string } // ephemeral emoji burst (not state)
  | { type: "ping"; t: number } // latency probe; server echoes it back
  | { type: "latency"; ms: number } // client's measured round-trip, to share

/** Server → client broadcasts. */
export type ServerMessage =
  | { type: "state"; state: RoomState }
  | { type: "reaction"; playerId: string; emoji: string }
  | { type: "pong"; t: number } // echo of a ping, to the prober only
  | { type: "latency"; playerId: string; ms: number } // a member's connection quality
  | { type: "kicked"; playerId: string } // the named member was removed by the host

export function createRoom(roomId: string): RoomState {
  return {
    roomId,
    phase: "lobby",
    members: [],
    game: null,
    autoSkipAt: null,
    kickedIds: [],
  }
}

/** Apply a client message from `senderId`, returning the next room state. */
export function applyClientMessage(
  state: RoomState,
  message: ClientMessage,
  senderId: string
): RoomState {
  switch (message.type) {
    case "join":
      return join(state, message.playerId, message.nickname, message.emoji)
    case "start":
      return start(state, senderId, message.settings)
    case "action":
      return action(state, senderId, message.action)
    case "reset":
      return reset(state, senderId)
    case "skip":
      return skip(state, senderId)
    case "rename":
      return rename(state, senderId, message.nickname)
    case "avatar":
      return avatar(state, senderId, message.emoji)
    case "kick":
      return kick(state, senderId, message.playerId)
    default:
      return state
  }
}

/**
 * The requested emoji if it's a known avatar not held by anyone else,
 * otherwise the first avatar still free in the room.
 */
function resolveEmoji(
  state: RoomState,
  requested: string | undefined,
  selfId: string
): string {
  const taken = new Set(
    state.members.filter((m) => m.id !== selfId).map((m) => m.emoji)
  )
  if (
    requested &&
    (PLAYER_EMOJIS as readonly string[]).includes(requested) &&
    !taken.has(requested)
  ) {
    return requested
  }
  return PLAYER_EMOJIS.find((e) => !taken.has(e)) ?? PLAYER_EMOJIS[0]
}

/** Add or reconnect a member. New members may only join during the lobby. */
function join(
  state: RoomState,
  playerId: string,
  nickname: string,
  emoji?: string
): RoomState {
  // A kicked player stays out (optional-chained: predates some stored rooms).
  if (state.kickedIds?.includes(playerId)) return state

  const existing = state.members.find((m) => m.id === playerId)
  if (existing) {
    const clean = nickname.trim() || existing.nickname
    // A reconnect keeps the member's avatar (changes go through `avatar`;
    // honoring the stale join preference here would revert them). Members
    // from before avatars existed get one assigned now.
    const face = existing.emoji ?? resolveEmoji(state, emoji, playerId)
    const members = state.members.map((m) =>
      m.id === playerId
        ? {
            ...m,
            connected: true,
            disconnectedAt: null,
            nickname: clean,
            emoji: face,
          }
        : m
    )
    // Keep the in-game token's name/avatar in step with the member's.
    const game = state.game
      ? {
          ...state.game,
          players: state.game.players.map((p) =>
            p.id === playerId ? { ...p, nickname: clean, emoji: face } : p
          ),
        }
      : null
    return { ...state, members, game }
  }

  // Unknown player: only admissible while still in the lobby and below the cap.
  if (state.phase !== "lobby" || state.members.length >= MAX_MEMBERS) {
    return state
  }

  const member: RoomMember = {
    id: playerId,
    nickname: nickname.trim() || `Player ${state.members.length + 1}`,
    color: PLAYER_COLORS[state.members.length % PLAYER_COLORS.length],
    emoji: resolveEmoji(state, emoji, playerId),
    isHost: state.members.length === 0,
    connected: true,
    disconnectedAt: null,
  }
  return { ...state, members: [...state.members, member] }
}

/** Change the sender's emoji avatar (must be a free one from the set). */
function avatar(state: RoomState, senderId: string, emoji: string): RoomState {
  const member = state.members.find((m) => m.id === senderId)
  if (!member) return state
  const face = resolveEmoji(state, emoji, senderId)
  if (face !== emoji || face === member.emoji) return state // taken/unknown/no-op
  const members = state.members.map((m) =>
    m.id === senderId ? { ...m, emoji: face } : m
  )
  const game = state.game
    ? {
        ...state.game,
        players: state.game.players.map((p) =>
          p.id === senderId ? { ...p, emoji: face } : p
        ),
      }
    : null
  return { ...state, members, game }
}

function start(
  state: RoomState,
  senderId: string,
  settings?: Partial<GameSettings>
): RoomState {
  const host = state.members.find((m) => m.id === senderId)
  if (
    !host?.isHost ||
    state.phase !== "lobby" ||
    state.members.length < MIN_MEMBERS
  ) {
    return state
  }
  const game = createInitialState(
    state.members.map((m) => ({
      id: m.id,
      nickname: m.nickname,
      color: m.color,
      emoji: m.emoji,
    })),
    undefined,
    { ...DEFAULT_SETTINGS, ...settings }
  )
  return { ...state, phase: "in-game", game, autoSkipAt: null }
}

/** Change the sender's nickname — in the lobby and, mid-match, on their token. */
function rename(
  state: RoomState,
  senderId: string,
  nickname: string
): RoomState {
  const clean = nickname.trim().slice(0, 24)
  if (!clean || !state.members.some((m) => m.id === senderId)) return state

  const members = state.members.map((m) =>
    m.id === senderId ? { ...m, nickname: clean } : m
  )
  const game = state.game
    ? {
        ...state.game,
        players: state.game.players.map((p) =>
          p.id === senderId ? { ...p, nickname: clean } : p
        ),
      }
    : null
  return { ...state, members, game }
}

/** Host removes a member — lobby only (mid-match, bankruptcy is the exit). */
function kick(state: RoomState, senderId: string, playerId: string): RoomState {
  const host = state.members.find((m) => m.id === senderId)
  if (!host?.isHost || state.phase !== "lobby" || playerId === senderId) {
    return state
  }
  if (!state.members.some((m) => m.id === playerId)) return state
  return {
    ...state,
    members: state.members.filter((m) => m.id !== playerId),
    kickedIds: [...(state.kickedIds ?? []), playerId].slice(-32),
  }
}

/**
 * Forward a game action. Trade and auction-bid actions are allowed out of turn
 * (the server stamps the sender's id so it can't be spoofed); everything else is
 * gated to the player whose turn it is.
 */
function action(
  state: RoomState,
  senderId: string,
  gameAction: GameAction
): RoomState {
  if (state.phase !== "in-game" || !state.game) return state
  // Server-only actions; never apply them from a client message.
  if (
    gameAction.type === "FORCE_END_TURN" ||
    gameAction.type === "FORCE_BANKRUPT"
  ) {
    return state
  }

  let stamped = gameAction
  if (gameAction.type === "PROPOSE_TRADE") {
    stamped = {
      ...gameAction,
      offer: { ...gameAction.offer, fromId: senderId },
    }
  } else if (
    gameAction.type === "RESPOND_TRADE" ||
    gameAction.type === "CANCEL_TRADE" ||
    gameAction.type === "PLACE_BID" ||
    gameAction.type === "PASS_BID" ||
    gameAction.type === "DECLARE_BANKRUPTCY"
  ) {
    // Out-of-turn actions: stamp the sender so bids/responses can't be spoofed.
    // The reducer still checks it's actually this player's move (bid rotation).
    stamped = { ...gameAction, playerId: senderId }
  } else {
    const current = state.game.players[state.game.currentPlayerIndex]
    if (current.id !== senderId) return state
  }

  return { ...state, game: gameReducer(state.game, stamped) }
}

/**
 * Skip the current player's turn — only when that player is disconnected, and
 * only at the request of another connected member. Keeps the game unstuck if
 * someone drops mid-turn (architecture.md §8).
 */
function skip(state: RoomState, senderId: string): RoomState {
  if (state.phase !== "in-game" || !state.game) return state
  const sender = state.members.find((m) => m.id === senderId)
  if (!sender?.connected) return state

  const current = state.game.players[state.game.currentPlayerIndex]
  const currentMember = state.members.find((m) => m.id === current.id)
  if (!currentMember || currentMember.connected) return state

  return { ...state, game: gameReducer(state.game, { type: "FORCE_END_TURN" }) }
}

/** True while it's a disconnected player's turn (candidate for auto-skip). */
export function currentPlayerDisconnected(state: RoomState): boolean {
  if (state.phase !== "in-game" || !state.game) return false
  if (state.game.status !== "playing") return false
  const current = state.game.players[state.game.currentPlayerIndex]
  const member = state.members.find((m) => m.id === current.id)
  return !!member && !member.connected
}

/** True if anyone is still connected — i.e. someone is present to play. */
export function anyMemberConnected(state: RoomState): boolean {
  return state.members.some((m) => m.connected)
}

/**
 * Whether the current turn should be auto-skipped: it's a disconnected player's
 * turn *and* at least one other member is still here to benefit. If the room has
 * emptied out, we never skip — the match just pauses until someone returns
 * (rather than "playing itself" in a loop with nobody watching).
 */
export function shouldAutoSkip(state: RoomState): boolean {
  return currentPlayerDisconnected(state) && anyMemberConnected(state)
}

/**
 * Force-skip the current player's turn — the server-side counterpart to `skip`,
 * invoked from the DO alarm rather than a client request (so it needs no
 * connected sender). Self-guards via `shouldAutoSkip`.
 */
export function autoSkip(state: RoomState): RoomState {
  if (!shouldAutoSkip(state)) return state
  return {
    ...state,
    game: gameReducer(state.game!, { type: "FORCE_END_TURN" }),
  }
}

/**
 * A match with nobody left connected — eligible to be abandoned once a grace
 * period elapses (so an empty room doesn't linger indefinitely).
 */
export function isAbandonable(state: RoomState): boolean {
  return state.phase === "in-game" && !!state.game && !anyMemberConnected(state)
}

/**
 * Discard an abandoned match: return the room to the lobby (members are kept so
 * anyone who reconnects can simply start a fresh game).
 */
export function abandonMatch(state: RoomState): RoomState {
  return { ...state, phase: "lobby", game: null, autoSkipAt: null }
}

/** Host returns the room to the lobby for a new match (members preserved). */
function reset(state: RoomState, senderId: string): RoomState {
  const host = state.members.find((m) => m.id === senderId)
  if (!host?.isHost) return state
  return { ...state, phase: "lobby", game: null, autoSkipAt: null }
}

/** Flip a member's connection flag (called by the server on connect/close). */
export function setConnected(
  state: RoomState,
  playerId: string,
  connected: boolean,
  now: number = Date.now()
): RoomState {
  return {
    ...state,
    members: state.members.map((m) =>
      m.id === playerId
        ? { ...m, connected, disconnectedAt: connected ? null : now }
        : m
    ),
  }
}

/**
 * Members who have been gone longer than `AUTO_BANKRUPT_MS` while the match
 * runs (and someone is still present to inherit an unstuck game). Their players
 * are force-bankrupted: properties return to the bank unowned.
 */
function overdueDisconnected(state: RoomState, now: number): RoomMember[] {
  if (state.phase !== "in-game" || !state.game) return []
  if (state.game.status !== "playing") return []
  if (!anyMemberConnected(state)) return []
  return state.members.filter((m) => {
    if (m.connected || m.disconnectedAt == null) return false
    if (now < m.disconnectedAt + AUTO_BANKRUPT_MS) return false
    const player = state.game!.players.find((p) => p.id === m.id)
    return !!player && !player.isBankrupt
  })
}

/** Force-bankrupt every overdue disconnected player (server alarm path). */
export function autoBankruptOverdue(state: RoomState, now: number): RoomState {
  let next = state
  for (const member of overdueDisconnected(state, now)) {
    if (next.phase !== "in-game" || !next.game) break
    next = {
      ...next,
      game: gameReducer(next.game, {
        type: "FORCE_BANKRUPT",
        playerId: member.id,
      }),
    }
  }
  return next
}

/** Earliest upcoming auto-bankrupt deadline (epoch ms), or null if none. */
export function nextAutoBankruptAt(state: RoomState): number | null {
  if (state.phase !== "in-game" || !state.game) return null
  if (state.game.status !== "playing") return null
  if (!anyMemberConnected(state)) return null
  let earliest: number | null = null
  for (const m of state.members) {
    if (m.connected || m.disconnectedAt == null) continue
    const player = state.game.players.find((p) => p.id === m.id)
    if (!player || player.isBankrupt) continue
    const at = m.disconnectedAt + AUTO_BANKRUPT_MS
    if (earliest === null || at < earliest) earliest = at
  }
  return earliest
}
