import { describe, expect, it } from "vitest"

import { BOARD } from "../board.config"
import { gameReducer } from "../reducer"
import type { GameState, StreetTile, TradeOffer } from "../types"
import { give, newGame, player, withNextRoll } from "./helpers"

const MEDITERRANEAN = 1
const BALTIC = 3
const BOARDWALK = 39

describe("END_TURN", () => {
  it("advances to the next player and resets turn state", () => {
    const s = newGame(3)
    s.phase = "awaiting-end"
    s.doublesCount = 1
    s.lastCard = { deck: "chance", cardId: "ch_dividend" }
    const next = gameReducer(s, { type: "END_TURN" })
    expect(next.currentPlayerIndex).toBe(1)
    expect(next.phase).toBe("awaiting-roll")
    expect(next.doublesCount).toBe(0)
    expect(next.lastCard).toBeNull()
    expect(next.turnCount).toBe(1)
    expect(next.history).toHaveLength(s.history.length + 1)
  })

  it("skips bankrupt players", () => {
    const s = newGame(3)
    s.phase = "awaiting-end"
    player(s, "p2").isBankrupt = true
    const next = gameReducer(s, { type: "END_TURN" })
    expect(next.currentPlayerIndex).toBe(2)
  })

  it("is ignored outside awaiting-end, but FORCE_END_TURN always works", () => {
    const s = withNextRoll(newGame(), 1, 2)
    const atBuy = gameReducer(s, { type: "ROLL_DICE" })
    expect(atBuy.phase).toBe("awaiting-buy")
    expect(gameReducer(atBuy, { type: "END_TURN" })).toBe(atBuy)
    const forced = gameReducer(atBuy, { type: "FORCE_END_TURN" })
    expect(forced.currentPlayerIndex).toBe(1)
    expect(forced.pendingPurchase).toBeNull()
    expect(forced.phase).toBe("awaiting-roll")
  })
})

describe("trading", () => {
  function offer(): TradeOffer {
    return {
      fromId: "p1",
      toId: "p2",
      give: { tiles: [MEDITERRANEAN], money: 100, jailCards: 0 },
      receive: { tiles: [BALTIC], money: 0, jailCards: 1 },
    }
  }

  function staged(): GameState {
    const s = newGame()
    give(s, "p1", MEDITERRANEAN)
    give(s, "p2", BALTIC)
    player(s, "p2").getOutOfJailCards = 1
    return s
  }

  it("proposing then accepting swaps both bundles atomically", () => {
    const proposed = gameReducer(staged(), {
      type: "PROPOSE_TRADE",
      offer: offer(),
    })
    expect(proposed.pendingTrade).toEqual(offer())
    const done = gameReducer(proposed, {
      type: "RESPOND_TRADE",
      accept: true,
      playerId: "p2",
    })
    expect(done.pendingTrade).toBeNull()
    expect(done.tiles[MEDITERRANEAN].ownerId).toBe("p2")
    expect(done.tiles[BALTIC].ownerId).toBe("p1")
    expect(player(done, "p1").balance).toBe(1400)
    expect(player(done, "p2").balance).toBe(1600)
    expect(player(done, "p1").getOutOfJailCards).toBe(1)
    expect(player(done, "p2").getOutOfJailCards).toBe(0)
  })

  it("only the addressee can respond; declining just clears it", () => {
    const proposed = gameReducer(staged(), {
      type: "PROPOSE_TRADE",
      offer: offer(),
    })
    const wrong = gameReducer(proposed, {
      type: "RESPOND_TRADE",
      accept: true,
      playerId: "p1",
    })
    expect(wrong.pendingTrade).toEqual(offer())
    const declined = gameReducer(proposed, {
      type: "RESPOND_TRADE",
      accept: false,
      playerId: "p2",
    })
    expect(declined.pendingTrade).toBeNull()
    expect(declined.tiles[MEDITERRANEAN].ownerId).toBe("p1")
  })

  it("only the proposer can cancel", () => {
    const proposed = gameReducer(staged(), {
      type: "PROPOSE_TRADE",
      offer: offer(),
    })
    expect(
      gameReducer(proposed, { type: "CANCEL_TRADE", playerId: "p2" })
        .pendingTrade
    ).toEqual(offer())
    expect(
      gameReducer(proposed, { type: "CANCEL_TRADE", playerId: "p1" })
        .pendingTrade
    ).toBeNull()
  })

  it("re-validates at accept time and voids a stale offer", () => {
    const proposed = gameReducer(staged(), {
      type: "PROPOSE_TRADE",
      offer: offer(),
    })
    // The offered tile's group gains a building before the response — the
    // tile is no longer tradable, so the accept must void, not apply.
    proposed.tiles[MEDITERRANEAN].houses = 1
    const done = gameReducer(proposed, {
      type: "RESPOND_TRADE",
      accept: true,
      playerId: "p2",
    })
    expect(done.pendingTrade).toBeNull()
    expect(done.tiles[MEDITERRANEAN].ownerId).toBe("p1")
    expect(player(done, "p1").balance).toBe(1500)
  })
})

describe("bankruptcy & victory", () => {
  it("auto-liquidates buildings and mortgages before failing", () => {
    // p1 lands Income Tax ($200) holding $100 cash + the brown set with a
    // house on Baltic: sells the house (+$25), mortgages both browns (+$60),
    // and survives with $185 - $200... still short -> bankrupt to the bank.
    const s = withNextRoll(newGame(), 1, 3) // 0 -> 4 (Income Tax)
    give(s, "p1", MEDITERRANEAN, BALTIC)
    s.tiles[BALTIC].houses = 1
    s.bank.houses = 31
    player(s, "p1").balance = 100
    const next = gameReducer(s, { type: "ROLL_DICE" })

    const p1 = player(next, "p1")
    expect(p1.isBankrupt).toBe(true)
    expect(p1.balance).toBe(0)
    // Assets fall back to the bank: unowned, unmortgaged, buildings restocked.
    expect(next.tiles[MEDITERRANEAN].ownerId).toBeNull()
    expect(next.tiles[BALTIC].ownerId).toBeNull()
    expect(next.tiles[BALTIC].mortgaged).toBe(false)
    expect(next.tiles[BALTIC].houses).toBe(0)
    expect(next.bank.houses).toBe(32)
    // Two players -> the survivor wins immediately.
    expect(next.status).toBe("finished")
    expect(next.winnerId).toBe("p2")
  })

  it("survives when liquidation covers the debt, stopping early", () => {
    // $130 cash + sell 2 houses (+$50) = $180 < $200, so one mortgage (+$30)
    // is also needed; liquidation must stop there and spare Baltic.
    const s = withNextRoll(newGame(), 1, 3)
    give(s, "p1", MEDITERRANEAN, BALTIC)
    s.tiles[BALTIC].houses = 2
    s.bank.houses = 30
    player(s, "p1").balance = 130
    const next = gameReducer(s, { type: "ROLL_DICE" })
    const p1 = player(next, "p1")
    expect(p1.isBankrupt).toBe(false)
    expect(p1.balance).toBe(10) // 130 + 50 + 30 - 200
    expect(next.tiles[BALTIC].houses).toBe(0)
    expect(next.bank.houses).toBe(32)
    expect(next.tiles[MEDITERRANEAN].mortgaged).toBe(true)
    expect(next.tiles[BALTIC].mortgaged).toBe(false)
    expect(next.status).toBe("playing")
  })

  it("hands everything to the creditor on rent bankruptcy", () => {
    // 3 players so the match continues. p1 lands on p2's hotel Boardwalk.
    const s = withNextRoll(newGame(3), 3, 4) // 32 -> 39 (Boardwalk)
    player(s, "p1").position = 32
    give(s, "p2", BOARDWALK)
    give(s, "p1", MEDITERRANEAN, BALTIC)
    s.tiles[BOARDWALK].houses = 5
    s.tiles[MEDITERRANEAN].mortgaged = true
    player(s, "p1").balance = 10
    const hotelRent = (BOARD[BOARDWALK] as StreetTile).rent[5]
    const next = gameReducer(s, { type: "ROLL_DICE" })

    const p1 = player(next, "p1")
    expect(p1.isBankrupt).toBe(true)
    // The creditor inherits the tiles (mortgage state intact) and all cash
    // p1 could raise: $10 + Baltic mortgage ($30).
    expect(next.tiles[MEDITERRANEAN].ownerId).toBe("p2")
    expect(next.tiles[MEDITERRANEAN].mortgaged).toBe(true)
    expect(next.tiles[BALTIC].ownerId).toBe("p2")
    expect(player(next, "p2").balance).toBe(1540)
    expect(player(next, "p2").balance).toBeLessThan(1500 + hotelRent)
    expect(next.status).toBe("playing")
    expect(next.winnerId).toBeNull()
  })

  it("drops a pending trade involving the bankrupted player", () => {
    const s = withNextRoll(newGame(3), 1, 3) // Income Tax
    give(s, "p1", BALTIC)
    player(s, "p1").balance = 10
    s.pendingTrade = {
      fromId: "p1",
      toId: "p2",
      give: { tiles: [BALTIC], money: 0, jailCards: 0 },
      receive: { tiles: [], money: 50, jailCards: 0 },
    }
    const next = gameReducer(s, { type: "ROLL_DICE" })
    expect(player(next, "p1").isBankrupt).toBe(true)
    expect(next.pendingTrade).toBeNull()
  })
})
