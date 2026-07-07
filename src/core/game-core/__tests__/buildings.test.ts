import { describe, expect, it } from "vitest"

import {
  reclaimBuildings,
  returnBuilding,
  takeBuilding,
} from "../helpers/buildings"
import { newGame } from "./helpers"

const STREET = 1

describe("building supply", () => {
  it("takes a house from the bank", () => {
    const state = newGame()
    takeBuilding(state, STREET)
    expect(state.tiles[STREET].houses).toBe(1)
    expect(state.bank.houses).toBe(31)
    expect(state.bank.hotels).toBe(12)
  })

  it("upgrading to a hotel returns the tile's 4 houses to the bank", () => {
    const state = newGame()
    state.tiles[STREET].houses = 4
    state.bank.houses = 28
    takeBuilding(state, STREET)
    expect(state.tiles[STREET].houses).toBe(5)
    expect(state.bank.hotels).toBe(11)
    expect(state.bank.houses).toBe(32)
  })

  it("selling a house returns it to the bank", () => {
    const state = newGame()
    state.tiles[STREET].houses = 2
    state.bank.houses = 30
    returnBuilding(state, STREET)
    expect(state.tiles[STREET].houses).toBe(1)
    expect(state.bank.houses).toBe(31)
  })

  it("selling a hotel draws 4 houses from the bank", () => {
    const state = newGame()
    state.tiles[STREET].houses = 5
    state.bank.hotels = 11
    returnBuilding(state, STREET)
    expect(state.tiles[STREET].houses).toBe(4)
    expect(state.bank.hotels).toBe(12)
    expect(state.bank.houses).toBe(28)
  })

  it("selling a hotel with a house shortage never goes negative", () => {
    const state = newGame()
    state.tiles[STREET].houses = 5
    state.bank.hotels = 11
    state.bank.houses = 2
    returnBuilding(state, STREET)
    expect(state.bank.houses).toBe(0)
    expect(state.bank.hotels).toBe(12)
  })

  it("reclaims all buildings on a transfer", () => {
    const state = newGame()
    state.tiles[STREET].houses = 3
    state.bank.houses = 29
    reclaimBuildings(state, STREET)
    expect(state.tiles[STREET].houses).toBe(0)
    expect(state.bank.houses).toBe(32)

    state.tiles[STREET].houses = 5
    state.bank.hotels = 11
    reclaimBuildings(state, STREET)
    expect(state.tiles[STREET].houses).toBe(0)
    expect(state.bank.hotels).toBe(12)
  })
})
