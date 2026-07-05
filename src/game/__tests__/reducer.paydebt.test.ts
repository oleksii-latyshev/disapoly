/** Normal pay mode (awaiting-pay) and the bankruptcy actions. */

import { describe, expect, it } from "vitest"

import { gameReducer } from "../reducer"
import { createInitialState, type PlayerSetup } from "../state"
import type { GameState } from "../types"
import { give, newGame, player, withNextRoll } from "./helpers"

/** Fresh match in "normal" pay mode. */
function newNormalGame(n = 2, seed = 42): GameState {
  const setups: PlayerSetup[] = Array.from({ length: n }, (_, i) => ({
    nickname: `P${i + 1}`,
  }))
  return createInitialState(setups, seed, { payMode: "normal" })
}

/** Stage p1 on tile 0 rolling [1, 2] onto p2-owned Baltic Avenue (tile 3). */
function rollOntoRent(state: GameState): GameState {
  give(state, "p2", 3)
  return gameReducer(withNextRoll(state, 1, 2), { type: "ROLL_DICE" })
}

describe("normal pay mode", () => {
  it("defaults to turbo: rent is deducted immediately", () => {
    const s = rollOntoRent(newGame())
    expect(s.phase).toBe("awaiting-end")
    expect(s.pendingDebt).toBeNull()
    expect(player(s, "p1").balance).toBe(1500 - 4)
    expect(player(s, "p2").balance).toBe(1500 + 4)
  })

  it("holds rent as a pending debt until PAY_DEBT", () => {
    const s = rollOntoRent(newNormalGame())
    expect(s.phase).toBe("awaiting-pay")
    expect(s.pendingDebt).toEqual({
      amount: 4,
      creditorId: "p2",
      reason: "rent",
      tileId: 3,
    })
    // Nothing has moved yet.
    expect(player(s, "p1").balance).toBe(1500)
    expect(player(s, "p2").balance).toBe(1500)

    const paid = gameReducer(s, { type: "PAY_DEBT" })
    expect(paid.phase).toBe("awaiting-end")
    expect(paid.pendingDebt).toBeNull()
    expect(player(paid, "p1").balance).toBe(1500 - 4)
    expect(player(paid, "p2").balance).toBe(1500 + 4)
  })

  it("holds tax as a pending debt to the bank", () => {
    const s = newNormalGame()
    // Roll [1, 3] onto Income Tax (tile 4, $200).
    const rolled = gameReducer(withNextRoll(s, 1, 3), { type: "ROLL_DICE" })
    expect(rolled.phase).toBe("awaiting-pay")
    expect(rolled.pendingDebt).toEqual({
      amount: 200,
      creditorId: null,
      reason: "tax",
      tileId: 4,
    })
    const paid = gameReducer(rolled, { type: "PAY_DEBT" })
    expect(player(paid, "p1").balance).toBe(1300)
    expect(paid.phase).toBe("awaiting-end")
  })

  it("blocks END_TURN and re-rolls while a debt is pending", () => {
    const s = rollOntoRent(newNormalGame())
    expect(gameReducer(s, { type: "END_TURN" })).toBe(s)
    expect(gameReducer(s, { type: "ROLL_DICE" })).toBe(s)
  })

  it("still grants the doubles re-roll after paying", () => {
    const s = newNormalGame()
    give(s, "p2", 3)
    // Doubles landing on rent: from tile 1, roll [1, 1] onto tile 3.
    s.players[0].position = 1
    const rolled = gameReducer(withNextRoll(s, 1, 1), { type: "ROLL_DICE" })
    expect(rolled.phase).toBe("awaiting-pay")
    const paid = gameReducer(rolled, { type: "PAY_DEBT" })
    expect(paid.phase).toBe("awaiting-roll") // doubles → roll again
  })

  it("collects the debt when the turn is force-ended", () => {
    const s = rollOntoRent(newNormalGame())
    const skipped = gameReducer(s, { type: "FORCE_END_TURN" })
    expect(skipped.pendingDebt).toBeNull()
    expect(player(skipped, "p1").balance).toBe(1500 - 4)
    expect(player(skipped, "p2").balance).toBe(1500 + 4)
    expect(skipped.currentPlayerIndex).toBe(1)
  })

  it("allows mortgaging while the debt is pending", () => {
    const s = rollOntoRent(newNormalGame())
    give(s, "p1", 1)
    const mortgaged = gameReducer(s, { type: "MORTGAGE", tileId: 1 })
    expect(mortgaged.tiles[1].mortgaged).toBe(true)
    expect(player(mortgaged, "p1").balance).toBe(1500 + 30)
  })

  it("liquidates and bankrupts on PAY_DEBT if the debtor can't cover", () => {
    const s = newNormalGame()
    give(s, "p2", 39)
    s.tiles[39].houses = 5 // hotel on Boardwalk: $2000 rent
    s.players[0].balance = 100
    // From 35, roll [1, 3] onto 39.
    s.players[0].position = 35
    const rolled = gameReducer(withNextRoll(s, 1, 3), { type: "ROLL_DICE" })
    expect(rolled.phase).toBe("awaiting-pay")
    const paid = gameReducer(rolled, { type: "PAY_DEBT" })
    expect(player(paid, "p1").isBankrupt).toBe(true)
    expect(paid.status).toBe("finished")
    expect(paid.winnerId).toBe("p2")
  })
})

describe("bankruptcy actions", () => {
  it("DECLARE_BANKRUPTCY returns properties to the bank unowned and clear", () => {
    const s = newGame(3)
    give(s, "p1", 1, 3)
    s.tiles[1].houses = 2
    s.bank.houses = 30 // the two staged houses came from the bank
    s.tiles[3].mortgaged = true
    const out = gameReducer(s, {
      type: "DECLARE_BANKRUPTCY",
      playerId: "p1",
    })
    expect(player(out, "p1").isBankrupt).toBe(true)
    expect(out.tiles[1].ownerId).toBeNull()
    expect(out.tiles[3].ownerId).toBeNull()
    expect(out.tiles[1].houses).toBe(0)
    expect(out.tiles[3].mortgaged).toBe(false)
    // Buildings flowed back to the bank.
    expect(out.bank.houses).toBe(32)
    // It was p1's turn — play moved on.
    expect(out.players[out.currentPlayerIndex].id).toBe("p2")
    expect(out.status).toBe("playing")
  })

  it("a pending debt is settled with the creditor before surrendering", () => {
    const s = rollOntoRent(newNormalGame(3))
    const out = gameReducer(s, {
      type: "DECLARE_BANKRUPTCY",
      playerId: "p1",
    })
    expect(player(out, "p1").isBankrupt).toBe(true)
    expect(player(out, "p2").balance).toBe(1500 + 4) // rent honored
  })

  it("out-of-turn surrender doesn't disturb the current turn", () => {
    const s = newGame(3)
    const out = gameReducer(s, {
      type: "DECLARE_BANKRUPTCY",
      playerId: "p3",
    })
    expect(player(out, "p3").isBankrupt).toBe(true)
    expect(out.currentPlayerIndex).toBe(0)
    expect(out.phase).toBe("awaiting-roll")
  })

  it("second-to-last surrender ends the game", () => {
    const s = newGame(2)
    const out = gameReducer(s, {
      type: "DECLARE_BANKRUPTCY",
      playerId: "p2",
    })
    expect(out.status).toBe("finished")
    expect(out.winnerId).toBe("p1")
  })

  it("FORCE_BANKRUPT behaves the same for a vanished player", () => {
    const s = newGame(3)
    give(s, "p2", 5)
    const out = gameReducer(s, { type: "FORCE_BANKRUPT", playerId: "p2" })
    expect(player(out, "p2").isBankrupt).toBe(true)
    expect(out.tiles[5].ownerId).toBeNull()
    expect(out.status).toBe("playing")
  })

  it("drops a pending trade involving the bankrupt player", () => {
    const s = newGame(3)
    give(s, "p3", 1)
    s.pendingTrade = {
      fromId: "p3",
      toId: "p1",
      give: { tiles: [1], money: 0, jailCards: 0 },
      receive: { tiles: [], money: 50, jailCards: 0 },
    }
    const out = gameReducer(s, {
      type: "DECLARE_BANKRUPTCY",
      playerId: "p3",
    })
    expect(out.pendingTrade).toBeNull()
  })

  it("is idempotent for an already-bankrupt player", () => {
    const s = newGame(3)
    s.players[2].isBankrupt = true
    const out = gameReducer(s, {
      type: "DECLARE_BANKRUPTCY",
      playerId: "p3",
    })
    expect(out).toBe(s)
  })
})
