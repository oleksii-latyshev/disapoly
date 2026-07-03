import { describe, expect, it } from "vitest"

import {
  BOARD,
  BOARD_SIZE,
  HOTELS_SUPPLY,
  HOUSES_SUPPLY,
  STARTING_BALANCE,
} from "../board.config"
import {
  canBuildHouse,
  canMortgage,
  canSellHouse,
  canUnmortgage,
  hasMonopoly,
  isTradeValid,
  mortgageValue,
  netWorth,
  rentFor,
  tradableTiles,
  unmortgageCost,
} from "../state"
import { give, newGame, player } from "./helpers"

// Board landmarks used across the suites (asserted here so a board edit that
// moves them fails loudly instead of silently invalidating other tests).
const MEDITERRANEAN = 1 // brown, $60
const BALTIC = 3 // brown, $60
const RAILROADS = BOARD.filter((t) => t.type === "railroad").map((t) => t.id)
const UTILITIES = BOARD.filter((t) => t.type === "utility").map((t) => t.id)

describe("board landmarks", () => {
  it("has the classic layout", () => {
    expect(BOARD_SIZE).toBe(40)
    expect(BOARD[MEDITERRANEAN].type).toBe("street")
    expect(BOARD[BALTIC].type).toBe("street")
    expect(BOARD[4].type).toBe("tax")
    expect(BOARD[7].type).toBe("chance")
    expect(BOARD[10].type).toBe("jail")
    expect(BOARD[30].type).toBe("goToJail")
    expect(RAILROADS).toHaveLength(4)
    expect(UTILITIES).toHaveLength(2)
  })
})

describe("createInitialState", () => {
  it("builds a fresh 2-player match", () => {
    const s = newGame(2)
    expect(s.status).toBe("playing")
    expect(s.phase).toBe("awaiting-roll")
    expect(s.players).toHaveLength(2)
    expect(s.players[0].id).toBe("p1")
    for (const p of s.players) {
      expect(p.balance).toBe(STARTING_BALANCE)
      expect(p.position).toBe(0)
      expect(p.isBankrupt).toBe(false)
    }
    expect(s.tiles).toHaveLength(40)
    expect(s.tiles.every((t) => t.ownerId === null && t.houses === 0)).toBe(
      true
    )
    expect(s.bank).toEqual({ houses: HOUSES_SUPPLY, hotels: HOTELS_SUPPLY })
  })

  it("is deterministic for a given seed", () => {
    expect(newGame(3, 7)).toEqual(newGame(3, 7))
    expect(newGame(3, 7).chance.order).not.toEqual(newGame(3, 8).chance.order)
  })
})

describe("hasMonopoly", () => {
  it("requires every group tile owned and unmortgaged", () => {
    const s = newGame()
    give(s, "p1", MEDITERRANEAN)
    expect(hasMonopoly(s, "p1", "brown")).toBe(false)
    give(s, "p1", BALTIC)
    expect(hasMonopoly(s, "p1", "brown")).toBe(true)
    s.tiles[BALTIC].mortgaged = true
    expect(hasMonopoly(s, "p1", "brown")).toBe(false)
  })
})

describe("rentFor", () => {
  it("charges base rent on a bare street", () => {
    const s = newGame()
    give(s, "p2", BALTIC)
    expect(rentFor(s, BALTIC, 7)).toBe(4)
  })

  it("doubles bare-land rent with a monopoly", () => {
    const s = newGame()
    give(s, "p2", MEDITERRANEAN, BALTIC)
    expect(rentFor(s, BALTIC, 7)).toBe(8)
  })

  it("uses the rent table with buildings (no extra doubling)", () => {
    const s = newGame()
    give(s, "p2", MEDITERRANEAN, BALTIC)
    s.tiles[BALTIC].houses = 3
    expect(rentFor(s, BALTIC, 7)).toBe(180)
    s.tiles[BALTIC].houses = 5 // hotel
    expect(rentFor(s, BALTIC, 7)).toBe(450)
  })

  it("charges nothing when unowned or mortgaged", () => {
    const s = newGame()
    expect(rentFor(s, BALTIC, 7)).toBe(0)
    give(s, "p2", BALTIC)
    s.tiles[BALTIC].mortgaged = true
    expect(rentFor(s, BALTIC, 7)).toBe(0)
  })

  it("scales railroad rent by count: 25/50/100/200", () => {
    const s = newGame()
    const expected = [25, 50, 100, 200]
    for (let n = 1; n <= 4; n++) {
      give(s, "p2", ...RAILROADS.slice(0, n))
      expect(rentFor(s, RAILROADS[0], 7)).toBe(expected[n - 1])
    }
  })

  it("charges utility rent as a dice multiple: 4x / 10x", () => {
    const s = newGame()
    give(s, "p2", UTILITIES[0])
    expect(rentFor(s, UTILITIES[0], 7)).toBe(28)
    give(s, "p2", UTILITIES[1])
    expect(rentFor(s, UTILITIES[0], 7)).toBe(70)
  })
})

describe("canBuildHouse", () => {
  it("requires a full unmortgaged color group", () => {
    const s = newGame()
    give(s, "p1", MEDITERRANEAN)
    expect(canBuildHouse(s, "p1", MEDITERRANEAN)).toBe(false)
    give(s, "p1", BALTIC)
    expect(canBuildHouse(s, "p1", MEDITERRANEAN)).toBe(true)
  })

  it("enforces even building within the group", () => {
    const s = newGame()
    give(s, "p1", MEDITERRANEAN, BALTIC)
    s.tiles[MEDITERRANEAN].houses = 1
    expect(canBuildHouse(s, "p1", MEDITERRANEAN)).toBe(false)
    expect(canBuildHouse(s, "p1", BALTIC)).toBe(true)
  })

  it("requires the bank to stock the piece", () => {
    const s = newGame()
    give(s, "p1", MEDITERRANEAN, BALTIC)
    s.bank.houses = 0
    expect(canBuildHouse(s, "p1", MEDITERRANEAN)).toBe(false)
    // The 5th building is a hotel and needs hotel stock, not house stock.
    s.tiles[MEDITERRANEAN].houses = 4
    s.tiles[BALTIC].houses = 4
    s.bank.hotels = 0
    expect(canBuildHouse(s, "p1", MEDITERRANEAN)).toBe(false)
    s.bank.hotels = 1
    expect(canBuildHouse(s, "p1", MEDITERRANEAN)).toBe(true)
  })

  it("requires funds", () => {
    const s = newGame()
    give(s, "p1", MEDITERRANEAN, BALTIC)
    player(s, "p1").balance = 10 // house costs 50
    expect(canBuildHouse(s, "p1", MEDITERRANEAN)).toBe(false)
  })
})

describe("canSellHouse", () => {
  it("enforces even selling (only from the most-built tile)", () => {
    const s = newGame()
    give(s, "p1", MEDITERRANEAN, BALTIC)
    s.tiles[MEDITERRANEAN].houses = 2
    s.tiles[BALTIC].houses = 1
    expect(canSellHouse(s, "p1", MEDITERRANEAN)).toBe(true)
    expect(canSellHouse(s, "p1", BALTIC)).toBe(false)
  })
})

describe("mortgage rules", () => {
  it("computes value at half price and lift cost at +10%", () => {
    expect(mortgageValue(BALTIC)).toBe(30)
    expect(unmortgageCost(BALTIC)).toBe(33)
  })

  it("blocks mortgaging while the group has buildings", () => {
    const s = newGame()
    give(s, "p1", MEDITERRANEAN, BALTIC)
    s.tiles[BALTIC].houses = 1
    expect(canMortgage(s, "p1", MEDITERRANEAN)).toBe(false)
    s.tiles[BALTIC].houses = 0
    expect(canMortgage(s, "p1", MEDITERRANEAN)).toBe(true)
  })

  it("requires funds to unmortgage", () => {
    const s = newGame()
    give(s, "p1", BALTIC)
    s.tiles[BALTIC].mortgaged = true
    player(s, "p1").balance = 10
    expect(canUnmortgage(s, "p1", BALTIC)).toBe(false)
    player(s, "p1").balance = 33
    expect(canUnmortgage(s, "p1", BALTIC)).toBe(true)
  })
})

describe("trading selectors", () => {
  it("excludes tiles whose group has buildings from tradableTiles", () => {
    const s = newGame()
    give(s, "p1", MEDITERRANEAN, BALTIC, RAILROADS[0])
    s.tiles[BALTIC].houses = 1
    expect(tradableTiles(s, "p1")).toEqual([RAILROADS[0]])
  })

  it("validates offers", () => {
    const s = newGame()
    give(s, "p1", BALTIC)
    const bundle = { tiles: [], money: 0, jailCards: 0 }
    const offer = {
      fromId: "p1",
      toId: "p2",
      give: { tiles: [BALTIC], money: 0, jailCards: 0 },
      receive: { ...bundle, money: 100 },
    }
    expect(isTradeValid(s, offer)).toBe(true)
    // No-op exchange.
    expect(
      isTradeValid(s, { ...offer, give: { ...bundle }, receive: { ...bundle } })
    ).toBe(false)
    // More money than the partner has.
    expect(
      isTradeValid(s, { ...offer, receive: { ...bundle, money: 99999 } })
    ).toBe(false)
    // Tile that isn't the proposer's.
    expect(
      isTradeValid(s, {
        ...offer,
        give: { tiles: [MEDITERRANEAN], money: 0, jailCards: 0 },
      })
    ).toBe(false)
    // Bankrupt partner.
    player(s, "p2").isBankrupt = true
    expect(isTradeValid(s, offer)).toBe(false)
  })
})

describe("netWorth", () => {
  it("adds owned tile prices to cash", () => {
    const s = newGame()
    give(s, "p1", BALTIC, RAILROADS[0]) // 60 + 200
    expect(netWorth(s, "p1")).toBe(STARTING_BALANCE + 260)
    expect(netWorth(s, "p2")).toBe(STARTING_BALANCE)
  })
})
