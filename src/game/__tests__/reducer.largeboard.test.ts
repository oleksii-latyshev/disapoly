import { describe, expect, it } from "vitest"

import {
  BOARDS,
  groupTileIdsOf,
  LARGE_BOARD,
  moveTargetTile,
} from "../board.config"
import { CHANCE, COMMUNITY_CHEST } from "../cards"
import { gameReducer } from "../reducer"
import { boardSizeOf, hasMonopoly, jailTileId } from "../state"
import type { GameState } from "../types"
import { give, newGame, player, withNextRoll } from "./helpers"

function largeGame(n = 2): GameState {
  return newGame(n, 42, { board: "large" })
}

/** Force the top of a deck so the next draw is exactly `cardId`. */
function forceTopCard(
  state: GameState,
  deck: "chance" | "chest",
  cardId: string
): void {
  const cards = deck === "chance" ? CHANCE : COMMUNITY_CHEST
  const idx = cards.findIndex((c) => c.id === cardId)
  if (idx < 0) throw new Error(`no card ${cardId}`)
  state[deck] = { order: [idx], pos: 0 }
}

describe("large board config", () => {
  it("has 48 tiles with corners at the quarter points", () => {
    expect(LARGE_BOARD).toHaveLength(48)
    expect(LARGE_BOARD.every((t, i) => t.id === i)).toBe(true)
    expect(LARGE_BOARD[0].type).toBe("go")
    expect(LARGE_BOARD[12].type).toBe("jail")
    expect(LARGE_BOARD[24].type).toBe("freeParking")
    expect(LARGE_BOARD[36].type).toBe("goToJail")
  })

  it("offers 10 street groups (2 more than classic)", () => {
    const large = groupTileIdsOf(LARGE_BOARD)
    const classic = groupTileIdsOf(BOARDS.classic)
    expect(Object.keys(large)).toHaveLength(10)
    expect(Object.keys(classic)).toHaveLength(8)
    expect(large.teal).toHaveLength(3)
    expect(large.violet).toHaveLength(3)
    expect(large.darkBlue).toHaveLength(3)
  })

  it("resolves the named card destinations on both boards", () => {
    expect(moveTargetTile(BOARDS.classic, "boardwalk")).toBe(39)
    expect(moveTargetTile(LARGE_BOARD, "boardwalk")).toBe(47)
    expect(moveTargetTile(BOARDS.classic, "illinois")).toBe(24)
    expect(moveTargetTile(LARGE_BOARD, "illinois")).toBe(28)
  })
})

describe("playing on the large board", () => {
  it("creates one tile state per large-board tile", () => {
    const s = largeGame()
    expect(s.tiles).toHaveLength(48)
    expect(boardSizeOf(s)).toBe(48)
    expect(jailTileId(s)).toBe(12)
  })

  it("wraps movement at 48 and pays the GO bonus", () => {
    const s = withNextRoll(largeGame(), 3, 4)
    player(s, "p1").position = 45 // Community Chest side; 45 + 7 = 52 % 48 = 4
    const next = gameReducer(s, { type: "ROLL_DICE" })
    const p1 = player(next, "p1")
    expect(p1.position).toBe(4) // Income Tax
    // Passed GO (+200) then paid the $200 tax.
    expect(p1.balance).toBe(1500)
  })

  it("recognizes a monopoly on a new group and doubles bare rent", () => {
    const s = withNextRoll(largeGame(), 2, 3)
    give(s, "p2", 5, 6, 7) // the whole teal group
    expect(hasMonopoly(s, "p2", "teal")).toBe(true)
    const next = gameReducer(s, { type: "ROLL_DICE" }) // p1: 0 -> 5
    expect(player(next, "p1").balance).toBe(1500 - 10) // $5 base ×2
    expect(player(next, "p2").balance).toBe(1500 + 10)
  })

  it("goToJail corner sends to the large board's jail", () => {
    const s = withNextRoll(largeGame(), 1, 2)
    player(s, "p1").position = 33 // 33 + 3 = 36 (Go To Jail)
    const next = gameReducer(s, { type: "ROLL_DICE" })
    expect(player(next, "p1").inJail).toBe(true)
    expect(player(next, "p1").position).toBe(12)
  })

  it("'advance to Boardwalk' lands on tile 47", () => {
    const s = withNextRoll(largeGame(), 1, 3) // GO -> 4? no: 0 + 4 = 4 (tax)…
    // Land on the Chance at 26 instead: start from 22.
    player(s, "p1").position = 22
    forceTopCard(s, "chance", "ch_boardwalk")
    const next = gameReducer(s, { type: "ROLL_DICE" }) // 22 + 4 = 26 (Chance)
    expect(player(next, "p1").position).toBe(47)
  })

  it("classic games are untouched: 40 tiles, Boardwalk at 39", () => {
    const s = newGame()
    expect(boardSizeOf(s)).toBe(40)
    expect(moveTargetTile(BOARDS.classic, "stCharles")).toBe(11)
    expect(jailTileId(s)).toBe(10)
  })
})
