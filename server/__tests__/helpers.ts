import {
  createRoom,
  type RoomMember,
  type RoomState,
} from "../../src/core/game-core/room"
import { createInitialState } from "../../src/core/game-core/state"

export function member(
  id: string,
  overrides: Partial<RoomMember> = {}
): RoomMember {
  return {
    id,
    nickname: id,
    color: "#f00",
    emoji: "🦊",
    isHost: id === "p1",
    connected: true,
    disconnectedAt: null,
    ...overrides,
  }
}

/** An in-game two-player room (p1 to move), seeded for reproducibility. */
export function inGameRoom(
  members: RoomMember[] = [member("p1"), member("p2")]
): RoomState {
  return {
    ...createRoom("room"),
    phase: "in-game",
    members,
    game: createInitialState(
      members.map((m) => ({ id: m.id, nickname: m.nickname })),
      42
    ),
  }
}
