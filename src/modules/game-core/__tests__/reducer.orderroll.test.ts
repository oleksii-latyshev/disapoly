/** Opening roll-off (settings.orderRoll): highest roll starts the game. */

import { describe, expect, it } from "vitest"

import { gameReducer } from "../reducer"
import { createInitialState, type PlayerSetup } from "../state"
import type { GameState } from "../types"
import { withNextRoll } from "./helpers"

function newRollOffGame(n = 2, seed = 42): GameState {
  const setups: PlayerSetup[] = Array.from({ length: n }, (_, i) => ({
    nickname: `P${i + 1}`,
  }))
  return createInitialState(setups, seed, { orderRoll: true })
}

/** Roll for the current player with a staged result. */
function rollAs(state: GameState, a: number, b: number): GameState {
  return gameReducer(withNextRoll(state, a, b), { type: "ROLL_DICE" })
}

describe("opening roll-off", () => {
  it("opens in the order-roll phase and blocks normal turn actions", () => {
    const s = newRollOffGame()
    expect(s.phase).toBe("order-roll")
    expect(s.orderRolls).toEqual({})
    expect(gameReducer(s, { type: "END_TURN" })).toBe(s)
    expect(gameReducer(s, { type: "BUY_PROPERTY" })).toBe(s)
  })

  it("highest roll starts; players stay in join order after them", () => {
    let s = newRollOffGame(3)
    s = rollAs(s, 1, 2) // p1: 3
    expect(s.phase).toBe("order-roll")
    expect(s.orderRolls?.p1).toBe(3)
    s = rollAs(s, 3, 3) // p2: 6
    s = rollAs(s, 1, 4) // p3: 5
    expect(s.phase).toBe("awaiting-roll")
    expect(s.orderRolls).toBeNull()
    expect(s.players[s.currentPlayerIndex].id).toBe("p2")
    // No tokens moved and no turns were consumed by the roll-off.
    expect(s.players.every((p) => p.position === 0)).toBe(true)
    expect(s.turnCount).toBe(0)
  })

  it("ties re-roll among the tied only", () => {
    let s = newRollOffGame(3)
    s = rollAs(s, 2, 3) // p1: 5
    s = rollAs(s, 1, 4) // p2: 5
    s = rollAs(s, 1, 2) // p3: 3
    // p1/p2 tied at 5 — p3 is out of the running, marked with the sentinel.
    expect(s.phase).toBe("order-roll")
    expect(s.orderRolls?.p3).toBe(-1)
    expect(s.orderRolls?.p1).toBeUndefined()
    expect(s.players[s.currentPlayerIndex].id).toBe("p1")

    s = rollAs(s, 1, 1) // p1: 2
    s = rollAs(s, 4, 2) // p2: 6 — even below p3's old 3, p3 can't win
    expect(s.phase).toBe("awaiting-roll")
    expect(s.players[s.currentPlayerIndex].id).toBe("p2")
  })

  it("FORCE_END_TURN rolls for an absent player instead of skipping", () => {
    let s = newRollOffGame(2)
    s = gameReducer(withNextRoll(s, 1, 2), { type: "FORCE_END_TURN" })
    expect(s.orderRolls?.p1).toBe(3)
    expect(s.phase).toBe("order-roll")
    expect(s.players[s.currentPlayerIndex].id).toBe("p2")
  })
})
