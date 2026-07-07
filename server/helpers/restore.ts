import { migrateGameState } from "../../src/core/game-core/state"
import type { RoomState } from "../../src/core/game-core/room"

/**
 * Revive a room persisted before a restart/deploy/eviction. Every socket
 * dropped with the old instance, so members flip to disconnected with their
 * absence clocks starting now; the auto-skip countdown is re-derived later.
 * A state persisted by an older build may predate newer game fields.
 */
export function restoreRoom(saved: RoomState, now: number): RoomState {
  return {
    ...saved,
    game: saved.game ? migrateGameState(saved.game) : null,
    autoSkipAt: null,
    members: saved.members.map((m) => ({
      ...m,
      connected: false,
      disconnectedAt: now,
    })),
  }
}
