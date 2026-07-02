/**
 * Room model and authoritative room reducer (Stage 1 — networking).
 *
 * This is the single source of truth for a multiplayer room: lobby membership
 * plus the in-progress game. It is pure and transport-agnostic — the PartyKit
 * server is a thin wrapper that feeds client messages in and broadcasts the
 * resulting state out. Keeping it here (in the alias-free game core) lets the
 * same logic bundle on the server without pulling in any React/UI code.
 */

import { PLAYER_COLORS } from "./board.config"
import { gameReducer } from "./reducer"
import { createInitialState } from "./state"
import type { GameAction, GameState } from "./types"

const MAX_MEMBERS = PLAYER_COLORS.length // 8
const MIN_MEMBERS = 2

export type RoomMember = {
  /** playerId — client-generated, persisted in localStorage for reconnect. */
  id: string
  nickname: string
  color: string
  isHost: boolean
  connected: boolean
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
}

/** Emoji reactions players can fling during a live game. */
export const REACTIONS: readonly string[] = ["👍", "😂", "😮", "🔥", "😢", "🎉"]

/** Client → server intents. */
export type ClientMessage =
  | { type: "join"; playerId: string; nickname: string }
  | { type: "start" }
  | { type: "action"; action: GameAction }
  | { type: "reset" }
  | { type: "skip" } // skip a disconnected player's turn
  | { type: "reaction"; emoji: string } // ephemeral emoji burst (not state)

/** Server → client broadcasts. */
export type ServerMessage =
  | { type: "state"; state: RoomState }
  | { type: "reaction"; playerId: string; emoji: string }

export function createRoom(roomId: string): RoomState {
  return { roomId, phase: "lobby", members: [], game: null, autoSkipAt: null }
}

/** Apply a client message from `senderId`, returning the next room state. */
export function applyClientMessage(
  state: RoomState,
  message: ClientMessage,
  senderId: string
): RoomState {
  switch (message.type) {
    case "join":
      return join(state, message.playerId, message.nickname)
    case "start":
      return start(state, senderId)
    case "action":
      return action(state, senderId, message.action)
    case "reset":
      return reset(state, senderId)
    case "skip":
      return skip(state, senderId)
    default:
      return state
  }
}

/** Add or reconnect a member. New members may only join during the lobby. */
function join(state: RoomState, playerId: string, nickname: string): RoomState {
  const existing = state.members.find((m) => m.id === playerId)
  if (existing) {
    const members = state.members.map((m) =>
      m.id === playerId
        ? { ...m, connected: true, nickname: nickname.trim() || m.nickname }
        : m
    )
    return { ...state, members }
  }

  // Unknown player: only admissible while still in the lobby and below the cap.
  if (state.phase !== "lobby" || state.members.length >= MAX_MEMBERS) {
    return state
  }

  const member: RoomMember = {
    id: playerId,
    nickname: nickname.trim() || `Player ${state.members.length + 1}`,
    color: PLAYER_COLORS[state.members.length % PLAYER_COLORS.length],
    isHost: state.members.length === 0,
    connected: true,
  }
  return { ...state, members: [...state.members, member] }
}

function start(state: RoomState, senderId: string): RoomState {
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
    }))
  )
  return { ...state, phase: "in-game", game, autoSkipAt: null }
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
  // FORCE_END_TURN is server-only; never apply it from a client message.
  if (gameAction.type === "FORCE_END_TURN") return state

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
    gameAction.type === "PASS_BID"
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
  return { ...state, game: gameReducer(state.game!, { type: "FORCE_END_TURN" }) }
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
  connected: boolean
): RoomState {
  return {
    ...state,
    members: state.members.map((m) =>
      m.id === playerId ? { ...m, connected } : m
    ),
  }
}
