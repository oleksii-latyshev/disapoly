import { describe, expect, it } from "vitest"

import { AUTO_BANKRUPT_MS } from "../../src/core/game-core/room"
import { ABANDON_MS, AUTO_SKIP_MS } from "../constants"
import {
  abandonDeadline,
  nextAlarmAt,
  runAlarmDuties,
  withAutoSkipDeadline,
} from "../helpers/deadlines"
import { inGameRoom, member } from "./helpers"

const NOW = 1_000_000

describe("withAutoSkipDeadline", () => {
  it("stays null while the current player is present", () => {
    const room = withAutoSkipDeadline(inGameRoom(), NOW)
    expect(room.autoSkipAt).toBeNull()
  })

  it("starts a countdown when the current player is gone", () => {
    const room = inGameRoom([
      member("p1", { connected: false, disconnectedAt: NOW }),
      member("p2"),
    ])
    expect(withAutoSkipDeadline(room, NOW).autoSkipAt).toBe(NOW + AUTO_SKIP_MS)
  })

  it("keeps an already-running countdown across resyncs", () => {
    const room = {
      ...inGameRoom([
        member("p1", { connected: false, disconnectedAt: NOW - 10_000 }),
        member("p2"),
      ]),
      autoSkipAt: NOW + 5_000,
    }
    expect(withAutoSkipDeadline(room, NOW).autoSkipAt).toBe(NOW + 5_000)
  })

  it("never counts down in an empty room", () => {
    const room = inGameRoom([
      member("p1", { connected: false, disconnectedAt: NOW }),
      member("p2", { connected: false, disconnectedAt: NOW }),
    ])
    expect(withAutoSkipDeadline(room, NOW).autoSkipAt).toBeNull()
  })
})

describe("abandonDeadline", () => {
  it("is null while anyone is connected", () => {
    expect(abandonDeadline(inGameRoom(), NOW)).toBeNull()
  })

  it("runs from the last disconnect once the room empties", () => {
    const room = inGameRoom([
      member("p1", { connected: false, disconnectedAt: NOW - 30_000 }),
      member("p2", { connected: false, disconnectedAt: NOW - 10_000 }),
    ])
    expect(abandonDeadline(room, NOW)).toBe(NOW - 10_000 + ABANDON_MS)
  })

  it("is null in the lobby", () => {
    const room = { ...inGameRoom(), phase: "lobby" as const, game: null }
    expect(abandonDeadline(room, NOW)).toBeNull()
  })
})

describe("nextAlarmAt", () => {
  it("is null with nothing pending", () => {
    expect(nextAlarmAt(inGameRoom(), NOW)).toBeNull()
  })

  it("picks the earliest applicable deadline", () => {
    const room = {
      ...inGameRoom([
        member("p1", { connected: false, disconnectedAt: NOW - 1_000 }),
        member("p2"),
      ]),
      autoSkipAt: NOW + AUTO_SKIP_MS,
    }
    expect(nextAlarmAt(room, NOW)).toBe(NOW + AUTO_SKIP_MS)
  })
})

describe("runAlarmDuties", () => {
  it("skips the absent current player's turn once due", () => {
    const room = {
      ...inGameRoom([
        member("p1", { connected: false, disconnectedAt: NOW - AUTO_SKIP_MS }),
        member("p2"),
      ]),
      autoSkipAt: NOW - 1,
    }
    const { state, abandoned } = runAlarmDuties(room, NOW)
    expect(abandoned).toBe(false)
    expect(state.autoSkipAt).toBeNull()
    expect(state.game!.currentPlayerIndex).toBe(1)
  })

  it("force-bankrupts a player gone past the absence limit", () => {
    const room = inGameRoom([
      member("p1", {
        connected: false,
        disconnectedAt: NOW - AUTO_BANKRUPT_MS - 1,
      }),
      member("p2"),
    ])
    const { state } = runAlarmDuties(room, NOW)
    const p1 = state.game!.players.find((p) => p.id === "p1")!
    expect(p1.isBankrupt).toBe(true)
  })

  it("abandons an emptied-out match after the grace period", () => {
    const room = inGameRoom([
      member("p1", { connected: false, disconnectedAt: NOW - ABANDON_MS - 1 }),
      member("p2", { connected: false, disconnectedAt: NOW - ABANDON_MS - 1 }),
    ])
    const { state, abandoned } = runAlarmDuties(room, NOW)
    expect(abandoned).toBe(true)
    expect(state.phase).toBe("lobby")
    expect(state.game).toBeNull()
  })
})
