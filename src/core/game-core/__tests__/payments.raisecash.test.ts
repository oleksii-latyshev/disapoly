import { describe, expect, it } from "vitest"

import { raiseCash } from "../reducer/payments"
import { give, newGame, player } from "./helpers"

// Classic brown group: tiles 1 and 3, price 60, houseCost 50.
const BROWN_A = 1
const BROWN_B = 3

describe("raiseCash", () => {
  it("sells buildings before mortgaging", () => {
    const state = newGame()
    const p1 = player(state, "p1")
    give(state, "p1", BROWN_A, BROWN_B)
    state.tiles[BROWN_A].houses = 1
    state.bank.houses = 31
    p1.balance = 0

    raiseCash(state, p1, 25)

    expect(p1.balance).toBe(25)
    expect(state.tiles[BROWN_A].houses).toBe(0)
    expect(state.bank.houses).toBe(32)
    expect(state.tiles[BROWN_A].mortgaged).toBe(false)
    expect(state.tiles[BROWN_B].mortgaged).toBe(false)
  })

  it("mortgages clear properties once buildings are gone", () => {
    const state = newGame()
    const p1 = player(state, "p1")
    give(state, "p1", BROWN_A, BROWN_B)
    p1.balance = 0

    raiseCash(state, p1, 50)

    expect(state.tiles[BROWN_A].mortgaged).toBe(true)
    expect(state.tiles[BROWN_B].mortgaged).toBe(true)
    expect(p1.balance).toBe(60)
  })

  it("stops as soon as the target is covered", () => {
    const state = newGame()
    const p1 = player(state, "p1")
    give(state, "p1", BROWN_A, BROWN_B)
    p1.balance = 0

    raiseCash(state, p1, 30)

    expect(state.tiles[BROWN_A].mortgaged).toBe(true)
    expect(state.tiles[BROWN_B].mortgaged).toBe(false)
    expect(p1.balance).toBe(30)
  })

  it("skips other players' property", () => {
    const state = newGame()
    const p1 = player(state, "p1")
    give(state, "p2", BROWN_A, BROWN_B)
    p1.balance = 10

    raiseCash(state, p1, 100)

    expect(p1.balance).toBe(10)
    expect(state.tiles[BROWN_A].mortgaged).toBe(false)
  })
})
