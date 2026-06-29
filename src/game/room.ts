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
}

/** Client → server intents. */
export type ClientMessage =
  | { type: "join"; playerId: string; nickname: string }
  | { type: "start" }
  | { type: "action"; action: GameAction }
  | { type: "reset" }

/** Server → client broadcasts. */
export type ServerMessage = { type: "state"; state: RoomState }

export function createRoom(roomId: string): RoomState {
  return { roomId, phase: "lobby", members: [], game: null }
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
  return { ...state, phase: "in-game", game }
}

/** Forward a game action only if it comes from the player whose turn it is. */
function action(
  state: RoomState,
  senderId: string,
  gameAction: GameAction
): RoomState {
  if (state.phase !== "in-game" || !state.game) return state
  const current = state.game.players[state.game.currentPlayerIndex]
  if (current.id !== senderId) return state
  return { ...state, game: gameReducer(state.game, gameAction) }
}

/** Host returns the room to the lobby for a new match (members preserved). */
function reset(state: RoomState, senderId: string): RoomState {
  const host = state.members.find((m) => m.id === senderId)
  if (!host?.isHost) return state
  return { ...state, phase: "lobby", game: null }
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
