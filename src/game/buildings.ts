/**
 * Building-supply bookkeeping, shared by the reducer and the event system.
 * Houses and hotels are finite (the classic shortage tactic), so every piece
 * placed or removed must flow through the bank's stock.
 */

import type { GameState } from "./types"

/**
 * Place one building on a tile and draw it from the bank. Precondition: the
 * bank stocks the piece (checked by `canBuildHouse`). Upgrading to a hotel
 * (the 5th step) takes a hotel and returns its 4 houses to the bank.
 */
export function takeBuilding(d: GameState, tileId: number): void {
  const tile = d.tiles[tileId]
  tile.houses += 1
  if (tile.houses === 5) {
    d.bank.hotels -= 1
    d.bank.houses += 4
  } else {
    d.bank.houses -= 1
  }
}

/**
 * Remove one building from a tile, returning it to the bank. Selling a hotel
 * "breaks down" into 4 houses drawn from the bank; if the bank is short (rule A
 * softened), we take whatever's available so liquidation never deadlocks.
 */
export function returnBuilding(d: GameState, tileId: number): void {
  const tile = d.tiles[tileId]
  const wasHotel = tile.houses === 5
  tile.houses -= 1
  if (wasHotel) {
    d.bank.hotels += 1
    d.bank.houses -= Math.min(4, d.bank.houses)
  } else {
    d.bank.houses += 1
  }
}

/** Return all of a tile's buildings to the bank (e.g. on bankruptcy transfer). */
export function reclaimBuildings(d: GameState, tileId: number): void {
  const tile = d.tiles[tileId]
  if (tile.houses === 5) d.bank.hotels += 1
  else d.bank.houses += tile.houses
  tile.houses = 0
}
