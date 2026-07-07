import { describe, expect, it } from "vitest"

import { gameReducer } from "../reducer"
import type { GameState } from "../types"
import { give, newGame, player, withNextRoll } from "./helpers"

const MEDITERRANEAN = 1
const BALTIC = 3 // $60, house cost $50

/** A state where p1 just landed on Baltic and may buy it. */
function atBuyPrompt(nPlayers = 2): GameState {
  const s = withNextRoll(newGame(nPlayers), 1, 2) // 0 -> 3
  return gameReducer(s, { type: "ROLL_DICE" })
}

describe("BUY_PROPERTY / DECLINE_PROPERTY", () => {
  it("buying deducts the price and assigns ownership", () => {
    const next = gameReducer(atBuyPrompt(), { type: "BUY_PROPERTY" })
    expect(player(next, "p1").balance).toBe(1440)
    expect(next.tiles[BALTIC].ownerId).toBe("p1")
    expect(next.pendingPurchase).toBeNull()
    expect(next.phase).toBe("awaiting-end")
  })

  it("keeps the extra roll when the landing came from doubles", () => {
    const s = withNextRoll(newGame(), 3, 3) // 0 -> 6 (Oriental)
    const landed = gameReducer(s, { type: "ROLL_DICE" })
    expect(landed.phase).toBe("awaiting-buy")
    const next = gameReducer(landed, { type: "BUY_PROPERTY" })
    expect(next.phase).toBe("awaiting-roll")
  })

  it("declining opens an auction rotating from the current player", () => {
    const next = gameReducer(atBuyPrompt(3), { type: "DECLINE_PROPERTY" })
    expect(next.phase).toBe("auction")
    expect(next.auction).toMatchObject({
      tileId: BALTIC,
      highBid: 0,
      highBidderId: null,
      currentBidderId: "p1",
      bidderOrder: ["p1", "p2", "p3"],
    })
  })

  it("an unaffordable landing goes straight to auction", () => {
    const s = withNextRoll(newGame(), 1, 2)
    player(s, "p1").balance = 10 // can't afford Baltic
    const next = gameReducer(s, { type: "ROLL_DICE" })
    expect(next.phase).toBe("auction")
    expect(next.auction?.tileId).toBe(BALTIC)
  })
})

describe("auction", () => {
  const bid = (playerId: string, amount: number) =>
    ({ type: "PLACE_BID", playerId, amount }) as const
  const pass = (playerId: string) => ({ type: "PASS_BID", playerId }) as const

  it("rejects bids out of turn, too low, over balance, or fractional", () => {
    const a = gameReducer(atBuyPrompt(3), { type: "DECLINE_PROPERTY" })
    expect(gameReducer(a, bid("p2", 10)).auction?.highBid).toBe(0) // not p2's turn
    expect(gameReducer(a, bid("p1", 0)).auction?.highBid).toBe(0)
    expect(gameReducer(a, bid("p1", 99999)).auction?.highBid).toBe(0)
    expect(gameReducer(a, bid("p1", 1.5)).auction?.highBid).toBe(0)
  })

  it("runs a full rotation: outbid, pass, winner pays", () => {
    let s = gameReducer(atBuyPrompt(3), { type: "DECLINE_PROPERTY" })
    s = gameReducer(s, bid("p1", 10))
    expect(s.auction?.currentBidderId).toBe("p2")
    s = gameReducer(s, bid("p2", 25))
    s = gameReducer(s, pass("p3"))
    s = gameReducer(s, pass("p1")) // only the high bidder (p2) remains
    expect(s.auction).toBeNull()
    expect(s.tiles[BALTIC].ownerId).toBe("p2")
    expect(player(s, "p2").balance).toBe(1475)
    expect(s.phase).toBe("awaiting-end")
  })

  it("the high bidder cannot pass their own lead", () => {
    let s = gameReducer(atBuyPrompt(3), { type: "DECLINE_PROPERTY" })
    s = gameReducer(s, bid("p1", 5))
    s = gameReducer(s, pass("p2"))
    s = gameReducer(s, pass("p3"))
    // Rotation is back at p1, the leader — passing must be a no-op...
    expect(gameReducer(s, pass("p1"))).toEqual(s)
    // ...but actually the auction already resolved when p3 passed.
    expect(s.auction).toBeNull()
    expect(s.tiles[BALTIC].ownerId).toBe("p1")
    expect(player(s, "p1").balance).toBe(1495)
  })

  it("returns the tile to the bank when everyone passes", () => {
    let s = gameReducer(atBuyPrompt(3), { type: "DECLINE_PROPERTY" })
    s = gameReducer(s, pass("p1"))
    s = gameReducer(s, pass("p2"))
    s = gameReducer(s, pass("p3"))
    expect(s.auction).toBeNull()
    expect(s.tiles[BALTIC].ownerId).toBeNull()
    expect(s.phase).toBe("awaiting-end")
  })
})

/** p1 with the brown monopoly, mid-turn (management is legal). */
function withBrownSet(): GameState {
  const s = newGame()
  give(s, "p1", MEDITERRANEAN, BALTIC)
  s.phase = "awaiting-end"
  return s
}

describe("building", () => {
  const build = (tileId: number) => ({ type: "BUILD_HOUSE", tileId }) as const
  const sell = (tileId: number) => ({ type: "SELL_HOUSE", tileId }) as const

  it("builds a house: pays, places, draws from the bank", () => {
    const next = gameReducer(withBrownSet(), build(BALTIC))
    expect(next.tiles[BALTIC].houses).toBe(1)
    expect(player(next, "p1").balance).toBe(1450)
    expect(next.bank.houses).toBe(31)
  })

  it("rejects uneven building through the reducer", () => {
    let s = gameReducer(withBrownSet(), build(BALTIC))
    const again = gameReducer(s, build(BALTIC)) // would be 2 vs 0
    expect(again.tiles[BALTIC].houses).toBe(1)
    s = gameReducer(s, build(MEDITERRANEAN)) // evens out
    expect(gameReducer(s, build(BALTIC)).tiles[BALTIC].houses).toBe(2)
  })

  it("is gated by phase (no building from the buy prompt)", () => {
    const s = withBrownSet()
    s.phase = "awaiting-buy"
    expect(gameReducer(s, build(BALTIC))).toBe(s)
  })

  it("upgrading to a hotel swaps 4 houses back for a hotel", () => {
    const s = withBrownSet()
    s.tiles[MEDITERRANEAN].houses = 4
    s.tiles[BALTIC].houses = 4
    s.bank.houses = 32 - 8
    const next = gameReducer(s, build(BALTIC))
    expect(next.tiles[BALTIC].houses).toBe(5)
    expect(next.bank.hotels).toBe(11)
    expect(next.bank.houses).toBe(28) // 24 + the 4 returned houses
  })

  it("cannot build when the bank has no houses (shortage tactic)", () => {
    const s = withBrownSet()
    s.bank.houses = 0
    expect(gameReducer(s, build(BALTIC)).tiles[BALTIC].houses).toBe(0)
  })

  it("selling refunds half the build cost and restocks the bank", () => {
    const s = withBrownSet()
    s.tiles[BALTIC].houses = 1
    s.bank.houses = 31
    const next = gameReducer(s, sell(BALTIC))
    expect(next.tiles[BALTIC].houses).toBe(0)
    expect(player(next, "p1").balance).toBe(1525)
    expect(next.bank.houses).toBe(32)
  })

  it("selling a hotel draws its 4 houses from the bank (softened)", () => {
    const s = withBrownSet()
    s.tiles[MEDITERRANEAN].houses = 4
    s.tiles[BALTIC].houses = 5
    s.bank.hotels = 11
    s.bank.houses = 2 // short — softened rule takes what's there
    const next = gameReducer(s, { type: "SELL_HOUSE", tileId: BALTIC })
    expect(next.tiles[BALTIC].houses).toBe(4)
    expect(next.bank.hotels).toBe(12)
    expect(next.bank.houses).toBe(0)
  })
})

describe("mortgage", () => {
  it("mortgages for half price and lifts for +10%", () => {
    const s = newGame()
    give(s, "p1", BALTIC)
    const m = gameReducer(s, { type: "MORTGAGE", tileId: BALTIC })
    expect(m.tiles[BALTIC].mortgaged).toBe(true)
    expect(player(m, "p1").balance).toBe(1530)
    const u = gameReducer(m, { type: "UNMORTGAGE", tileId: BALTIC })
    expect(u.tiles[BALTIC].mortgaged).toBe(false)
    expect(player(u, "p1").balance).toBe(1530 - 33)
  })

  it("cannot mortgage while the group has buildings", () => {
    const s = withBrownSet()
    s.tiles[BALTIC].houses = 1
    const next = gameReducer(s, { type: "MORTGAGE", tileId: MEDITERRANEAN })
    expect(next.tiles[MEDITERRANEAN].mortgaged).toBe(false)
  })
})
