// Authoritative room model: lobby membership plus the in-progress game.
// Pure and transport-agnostic — the Durable Object server feeds client
// messages in and broadcasts the resulting state out.

import { PLAYER_COLORS, PLAYER_EMOJIS } from "./constants/board"
import { gameReducer } from "./reducer"
import { createInitialState, DEFAULT_SETTINGS } from "./state"
import type { GameAction, GameSettings, GameState } from "./types"

const MAX_MEMBERS = PLAYER_COLORS.length
const MIN_MEMBERS = 2

/** How long a player may stay disconnected mid-match before being removed. */
export const AUTO_BANKRUPT_MS = 5 * 60_000

export type RoomMember = {
  /** playerId — client-generated, persisted in localStorage for reconnect. */
  id: string
  nickname: string
  color: string
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
  /** Deadline (epoch ms) for auto-skipping the absent current player's turn. */
  autoSkipAt: number | null
  /** playerIds removed by the host — barred from rejoining this room. */
  kickedIds: string[]
}

export const REACTIONS: readonly string[] = ["👍", "😂", "😮", "🔥", "😢", "🎉"]

export type ClientMessage =
  | { type: "join"; playerId: string; nickname: string; emoji?: string }
  | { type: "start"; settings?: Partial<GameSettings> }
  | { type: "action"; action: GameAction }
  | { type: "reset" }
  | { type: "skip" }
  | { type: "rename"; nickname: string }
  | { type: "avatar"; emoji: string }
  | { type: "kick"; playerId: string }
  | { type: "reaction"; emoji: string }
  | { type: "ping"; t: number }
  | { type: "latency"; ms: number }

export type ServerMessage =
  | { type: "state"; state: RoomState }
  | { type: "reaction"; playerId: string; emoji: string }
  | { type: "pong"; t: number }
  | { type: "latency"; playerId: string; ms: number }
  | { type: "kicked"; playerId: string }

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

/** The requested emoji if known and free, otherwise the first free one. */
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
  if (state.kickedIds?.includes(playerId)) return state

  const existing = state.members.find((m) => m.id === playerId)
  if (existing) {
    const clean = nickname.trim() || existing.nickname
    // A reconnect keeps the member's avatar — honoring the stale join
    // preference here would revert changes made through `avatar`.
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

function avatar(state: RoomState, senderId: string, emoji: string): RoomState {
  const member = state.members.find((m) => m.id === senderId)
  if (!member) return state
  const face = resolveEmoji(state, emoji, senderId)
  if (face !== emoji || face === member.emoji) return state
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
 * Forward a game action. Trades, bids and bankruptcy declarations are allowed
 * out of turn — the sender's id is stamped in so it can't be spoofed.
 * Everything else is gated to the player whose turn it is.
 */
function action(
  state: RoomState,
  senderId: string,
  gameAction: GameAction
): RoomState {
  if (state.phase !== "in-game" || !state.game) return state
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
    stamped = { ...gameAction, playerId: senderId }
  } else {
    const current = state.game.players[state.game.currentPlayerIndex]
    if (current.id !== senderId) return state
  }

  return { ...state, game: gameReducer(state.game, stamped) }
}

/** Skip the current player's turn — only when they're disconnected, and only
 * at the request of another connected member. */
function skip(state: RoomState, senderId: string): RoomState {
  if (state.phase !== "in-game" || !state.game) return state
  const sender = state.members.find((m) => m.id === senderId)
  if (!sender?.connected) return state

  const current = state.game.players[state.game.currentPlayerIndex]
  const currentMember = state.members.find((m) => m.id === current.id)
  if (!currentMember || currentMember.connected) return state

  return { ...state, game: gameReducer(state.game, { type: "FORCE_END_TURN" }) }
}

export function currentPlayerDisconnected(state: RoomState): boolean {
  if (state.phase !== "in-game" || !state.game) return false
  if (state.game.status !== "playing") return false
  const current = state.game.players[state.game.currentPlayerIndex]
  const member = state.members.find((m) => m.id === current.id)
  return !!member && !member.connected
}

export function anyMemberConnected(state: RoomState): boolean {
  return state.members.some((m) => m.connected)
}

/** An empty room never auto-skips — the match pauses rather than playing
 * itself with nobody watching. */
export function shouldAutoSkip(state: RoomState): boolean {
  return currentPlayerDisconnected(state) && anyMemberConnected(state)
}

/** Server-side counterpart to `skip`, invoked from the DO alarm. */
export function autoSkip(state: RoomState): RoomState {
  if (!shouldAutoSkip(state)) return state
  return {
    ...state,
    game: gameReducer(state.game!, { type: "FORCE_END_TURN" }),
  }
}

export function isAbandonable(state: RoomState): boolean {
  return state.phase === "in-game" && !!state.game && !anyMemberConnected(state)
}

/** Return the room to the lobby; members are kept so anyone who reconnects
 * can start a fresh game. */
export function abandonMatch(state: RoomState): RoomState {
  return { ...state, phase: "lobby", game: null, autoSkipAt: null }
}

function reset(state: RoomState, senderId: string): RoomState {
  const host = state.members.find((m) => m.id === senderId)
  if (!host?.isHost) return state
  return { ...state, phase: "lobby", game: null, autoSkipAt: null }
}

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
