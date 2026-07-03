import { describe, expect, it } from "vitest"

import { BOARD } from "../board.config"
import { CHANCE, COMMUNITY_CHEST } from "../cards"
import { gameReducer } from "../reducer"
import type { GameState, StreetTile } from "../types"
import { give, newGame, player, withNextRoll } from "./helpers"

const ROLL = { type: "ROLL_DICE" } as const
const CHEST_TILE = 17

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

/** p1 rolls [3,4] from GO onto Chance with `cardId` on top of the deck. */
function drawChance(cardId: string, mutate?: (s: GameState) => void) {
  const s = withNextRoll(newGame(3), 3, 4) // 0 -> 7 (Chance)
  forceTopCard(s, "chance", cardId)
  mutate?.(s)
  return gameReducer(s, ROLL)
}

describe("chance / community chest", () => {
  it("records the drawn card for the UI", () => {
    const next = drawChance("ch_dividend")
    expect(next.lastCard).toEqual({ deck: "chance", cardId: "ch_dividend" })
  })

  it("money card credits the player", () => {
    const next = drawChance("ch_dividend") // +$50
    expect(player(next, "p1").balance).toBe(1550)
    expect(next.phase).toBe("awaiting-end")
  })

  it("go-to-jail card jails without passing GO", () => {
    const next = drawChance("ch_jail")
    expect(player(next, "p1").inJail).toBe(true)
    expect(player(next, "p1").position).toBe(10)
    expect(player(next, "p1").balance).toBe(1500)
  })

  it("get-out-of-jail card is kept", () => {
    const next = drawChance("ch_jailfree")
    expect(player(next, "p1").getOutOfJailCards).toBe(1)
  })

  it("advance-to-GO collects the GO bonus", () => {
    const next = drawChance("ch_go")
    expect(player(next, "p1").position).toBe(0)
    expect(player(next, "p1").balance).toBe(1700)
  })

  it("a movement card resolves the destination tile (rent applies)", () => {
    const next = drawChance("ch_illinois", (s) => give(s, "p2", 24))
    const rent = (BOARD[24] as StreetTile).rent[0]
    expect(player(next, "p1").position).toBe(24)
    expect(player(next, "p1").balance).toBe(1500 - rent)
    expect(player(next, "p2").balance).toBe(1500 + rent)
  })

  it("move-back card resolves the new tile without a GO bonus", () => {
    const next = drawChance("ch_back3") // 7 -> 4 (Income Tax)
    expect(player(next, "p1").position).toBe(4)
    expect(player(next, "p1").balance).toBe(1300)
  })

  it("repairs card charges per house and hotel", () => {
    const next = drawChance("ch_repairs", (s) => {
      give(s, "p1", 1, 3)
      s.tiles[1].houses = 3
      s.tiles[3].houses = 5 // hotel
    })
    // $25/house, $100/hotel -> 3*25 + 100 = 175
    expect(player(next, "p1").balance).toBe(1500 - 175)
  })

  it("pay-each card pays every active opponent", () => {
    const next = drawChance("ch_chairman") // $50 each, 2 opponents
    expect(player(next, "p1").balance).toBe(1400)
    expect(player(next, "p2").balance).toBe(1550)
    expect(player(next, "p3").balance).toBe(1550)
  })

  it("collect-from-each card charges every active opponent", () => {
    const s = withNextRoll(newGame(3), 3, 4) // 10 -> 17 (Community Chest)
    player(s, "p1").position = 10
    forceTopCard(s, "chest", "cc_birthday") // $10 from each
    const next = gameReducer(s, ROLL)
    expect(player(next, "p1").position).toBe(CHEST_TILE)
    expect(player(next, "p1").balance).toBe(1520)
    expect(player(next, "p2").balance).toBe(1490)
  })

  it("reshuffles the deck when it wraps", () => {
    const s = withNextRoll(newGame(), 3, 4)
    s.chance = {
      order: CHANCE.map((_, i) => i),
      pos: CHANCE.length, // exhausted — must reshuffle before drawing
    }
    const next = gameReducer(s, ROLL)
    expect(next.lastCard?.deck).toBe("chance")
    expect(next.chance.pos).toBe(1)
    expect(next.chance.order).toHaveLength(CHANCE.length)
  })
})
