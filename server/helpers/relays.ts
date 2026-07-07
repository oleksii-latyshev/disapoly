// Ephemeral messages relayed to everyone without ever touching room state.

import { REACTIONS, type ServerMessage } from "../../src/core/game-core/room"

export function reactionRelay(
  playerId: string,
  emoji: string
): Extract<ServerMessage, { type: "reaction" }> | null {
  if (!REACTIONS.includes(emoji)) return null
  return { type: "reaction", playerId, emoji }
}

export function latencyRelay(
  playerId: string,
  ms: number
): Extract<ServerMessage, { type: "latency" }> {
  return {
    type: "latency",
    playerId,
    ms: Math.max(0, Math.min(99999, Math.round(ms))),
  }
}
