import { describe, expect, it } from "vitest"

import { REACTIONS } from "../../src/core/game-core/room"
import { latencyRelay, reactionRelay } from "../helpers/relays"

describe("reactionRelay", () => {
  it("relays a known reaction", () => {
    expect(reactionRelay("p1", REACTIONS[0])).toEqual({
      type: "reaction",
      playerId: "p1",
      emoji: REACTIONS[0],
    })
  })

  it("drops an unknown emoji", () => {
    expect(reactionRelay("p1", "🦄")).toBeNull()
  })
})

describe("latencyRelay", () => {
  it("rounds and clamps the reported round-trip", () => {
    expect(latencyRelay("p1", 42.6).ms).toBe(43)
    expect(latencyRelay("p1", -5).ms).toBe(0)
    expect(latencyRelay("p1", 1e9).ms).toBe(99999)
  })
})
