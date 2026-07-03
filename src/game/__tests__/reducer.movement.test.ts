import { describe, expect, it } from "vitest"

import { GO_PAYOUT, JAIL_FINE, JAIL_TILE_ID } from "../board.config"
import { gameReducer } from "../reducer"
import { give, newGame, player, withNextRoll } from "./helpers"

const ROLL = { type: "ROLL_DICE" } as const

describe("ROLL_DICE — movement & landing", () => {
  it("is ignored outside awaiting-roll (same state object)", () => {
    const s = newGame()
    s.phase = "awaiting-end"
    expect(gameReducer(s, ROLL)).toBe(s)
  })

  it("moves by the dice sum and resolves a tax landing", () => {
    const s = withNextRoll(newGame(), 1, 3) // 0 -> 4 (Income Tax, $200)
    const next = gameReducer(s, ROLL)
    expect(next.dice).toEqual([1, 3])
    expect(player(next, "p1").position).toBe(4)
    expect(player(next, "p1").balance).toBe(1300)
    expect(next.phase).toBe("awaiting-end")
  })

  it("offers an affordable unowned tile for purchase", () => {
    const s = withNextRoll(newGame(), 1, 2) // 0 -> 3 (Baltic, $60)
    const next = gameReducer(s, ROLL)
    expect(next.phase).toBe("awaiting-buy")
    expect(next.pendingPurchase).toBe(3)
  })

  it("pays rent to the owner on landing", () => {
    const s = withNextRoll(newGame(), 1, 2)
    give(s, "p2", 3) // Baltic, base rent 4
    const next = gameReducer(s, ROLL)
    expect(player(next, "p1").balance).toBe(1496)
    expect(player(next, "p2").balance).toBe(1504)
    expect(next.phase).toBe("awaiting-end")
  })

  it("doubles bare-land rent when the owner has the monopoly", () => {
    const s = withNextRoll(newGame(), 1, 2)
    give(s, "p2", 1, 3)
    const next = gameReducer(s, ROLL)
    expect(player(next, "p1").balance).toBe(1492)
  })

  it("charges utility rent from the arriving dice sum", () => {
    const s = withNextRoll(newGame(), 3, 4) // 5 -> 12 (Electric)
    player(s, "p1").position = 5
    give(s, "p2", 12, 28) // both utilities -> 10x dice
    const next = gameReducer(s, ROLL)
    expect(player(next, "p1").balance).toBe(1500 - 70)
  })

  it("pays the GO bonus when passing GO", () => {
    const s = withNextRoll(newGame(), 2, 3) // 36 -> 1 (past GO)
    player(s, "p1").position = 36
    const next = gameReducer(s, ROLL)
    expect(player(next, "p1").position).toBe(1)
    expect(player(next, "p1").balance).toBe(1500 + GO_PAYOUT)
    expect(next.phase).toBe("awaiting-buy") // Mediterranean is affordable
  })

  it("grants an extra roll on doubles", () => {
    const s = withNextRoll(newGame(), 1, 1) // 8 -> 10 (just visiting)
    player(s, "p1").position = 8
    const next = gameReducer(s, ROLL)
    expect(next.doublesCount).toBe(1)
    expect(next.phase).toBe("awaiting-roll")
    expect(player(next, "p1").inJail).toBe(false)
  })

  it("sends to jail on the third consecutive double, without moving", () => {
    const s = withNextRoll(newGame(), 2, 2)
    s.doublesCount = 2
    player(s, "p1").position = 8
    const next = gameReducer(s, ROLL)
    const p1 = player(next, "p1")
    expect(p1.inJail).toBe(true)
    expect(p1.position).toBe(JAIL_TILE_ID)
    expect(next.phase).toBe("awaiting-end")
  })

  it("sends to jail from the Go To Jail tile", () => {
    const s = withNextRoll(newGame(), 2, 3) // 25 -> 30
    player(s, "p1").position = 25
    const next = gameReducer(s, ROLL)
    expect(player(next, "p1").inJail).toBe(true)
    expect(player(next, "p1").position).toBe(JAIL_TILE_ID)
  })
})

/** A player already sitting in jail. */
function jailed(jailTurns = 0) {
  const s = newGame()
  const p1 = player(s, "p1")
  p1.inJail = true
  p1.position = JAIL_TILE_ID
  p1.jailTurns = jailTurns
  return s
}

describe("jail", () => {
  it("PAY_JAIL_FINE frees the player, who still gets to roll", () => {
    const next = gameReducer(jailed(), { type: "PAY_JAIL_FINE" })
    expect(player(next, "p1").inJail).toBe(false)
    expect(player(next, "p1").balance).toBe(1500 - JAIL_FINE)
    expect(next.phase).toBe("awaiting-roll")
  })

  it("USE_JAIL_CARD consumes a card; without one it is a no-op", () => {
    const s = jailed()
    expect(gameReducer(s, { type: "USE_JAIL_CARD" })).toEqual(s)
    player(s, "p1").getOutOfJailCards = 1
    const next = gameReducer(s, { type: "USE_JAIL_CARD" })
    expect(player(next, "p1").inJail).toBe(false)
    expect(player(next, "p1").getOutOfJailCards).toBe(0)
    expect(next.phase).toBe("awaiting-roll")
  })

  it("rolling doubles escapes and moves, but grants no extra roll", () => {
    const s = withNextRoll(jailed(), 5, 5) // 10 -> 20 (Free Parking)
    const next = gameReducer(s, ROLL)
    const p1 = player(next, "p1")
    expect(p1.inJail).toBe(false)
    expect(p1.position).toBe(20)
    expect(next.phase).toBe("awaiting-end")
  })

  it("a failed escape roll stays in jail and counts the attempt", () => {
    const s = withNextRoll(jailed(), 1, 2)
    const next = gameReducer(s, ROLL)
    const p1 = player(next, "p1")
    expect(p1.inJail).toBe(true)
    expect(p1.position).toBe(JAIL_TILE_ID)
    expect(p1.jailTurns).toBe(1)
    expect(next.phase).toBe("awaiting-end")
  })

  it("the third failed attempt forces the fine and then moves", () => {
    const s = withNextRoll(jailed(2), 1, 2)
    const next = gameReducer(s, ROLL)
    const p1 = player(next, "p1")
    expect(p1.inJail).toBe(false)
    expect(p1.balance).toBe(1500 - JAIL_FINE)
    expect(p1.position).toBe(JAIL_TILE_ID + 3)
  })
})
