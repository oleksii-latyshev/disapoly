import {
  boardFor,
  groupTileIdsOf,
  RAILROAD_RENT,
  UTILITY_MULTIPLIER,
} from "../constants/board"
import type {
  ColorGroup,
  GameState,
  HistoryPoint,
  Player,
  TileDefinition,
} from "../types"

export function boardOf(state: GameState): readonly TileDefinition[] {
  return boardFor(state.settings?.board)
}

export function boardSizeOf(state: GameState): number {
  return boardOf(state).length
}

export function jailTileId(state: GameState): number {
  return boardOf(state).find((t) => t.type === "jail")!.id
}

export function tileDef(state: GameState, id: number): TileDefinition {
  return boardOf(state)[id]
}

export function groupIds(state: GameState, group: ColorGroup): number[] {
  return groupTileIdsOf(boardOf(state))[group] ?? []
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex]
}

export function playerById(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id)
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.isBankrupt)
}

export function hasMonopoly(
  state: GameState,
  playerId: string,
  group: ColorGroup
): boolean {
  const ids = groupIds(state, group)
  return (
    ids.length > 0 &&
    ids.every((id) => {
      const tile = state.tiles[id]
      return tile.ownerId === playerId && !tile.mortgaged
    })
  )
}

export function countOwnedOfType(
  state: GameState,
  playerId: string,
  type: "railroad" | "utility"
): number {
  return boardOf(state).reduce(
    (n, tile) =>
      tile.type === type && state.tiles[tile.id].ownerId === playerId
        ? n + 1
        : n,
    0
  )
}

export function rentFor(
  state: GameState,
  tileId: number,
  diceSum: number
): number {
  const def = tileDef(state, tileId)
  const tile = state.tiles[tileId]
  if (!tile.ownerId || tile.mortgaged) return 0

  if (def.type === "street") {
    if (tile.houses > 0) return def.rent[tile.houses]
    const base = def.rent[0]
    return hasMonopoly(state, tile.ownerId, def.group) ? base * 2 : base
  }
  if (def.type === "railroad") {
    const owned = countOwnedOfType(state, tile.ownerId, "railroad")
    return RAILROAD_RENT[Math.min(owned, 4) - 1] ?? 0
  }
  if (def.type === "utility") {
    const owned = countOwnedOfType(state, tile.ownerId, "utility")
    const mult = UTILITY_MULTIPLIER[Math.min(owned, 2) - 1] ?? 0
    return mult * diceSum
  }
  return 0
}

export type PurchasePreview =
  | {
      kind: "street"
      baseRent: number
      rentWithSet: number
      owned: number
      total: number
      completesSet: boolean
    }
  | { kind: "railroad"; owned: number; total: number; rentAfter: number }
  | { kind: "utility"; owned: number; total: number; multiplierAfter: number }

export function purchasePreview(
  state: GameState,
  tileId: number,
  playerId: string
): PurchasePreview | null {
  const def = tileDef(state, tileId)
  if (def.type === "street") {
    const ids = groupIds(state, def.group)
    const ownedNow = ids.filter(
      (id) => state.tiles[id].ownerId === playerId
    ).length
    const owned = ownedNow + 1
    return {
      kind: "street",
      baseRent: def.rent[0],
      rentWithSet: def.rent[0] * 2,
      owned,
      total: ids.length,
      completesSet: owned === ids.length,
    }
  }
  if (def.type === "railroad") {
    const owned = countOwnedOfType(state, playerId, "railroad") + 1
    return {
      kind: "railroad",
      owned,
      total: 4,
      rentAfter: RAILROAD_RENT[Math.min(owned, 4) - 1] ?? 0,
    }
  }
  if (def.type === "utility") {
    const owned = countOwnedOfType(state, playerId, "utility") + 1
    return {
      kind: "utility",
      owned,
      total: 2,
      multiplierAfter: UTILITY_MULTIPLIER[Math.min(owned, 2) - 1] ?? 0,
    }
  }
  return null
}

export function priceOf(state: GameState, tileId: number): number {
  const def = tileDef(state, tileId)
  return "price" in def ? def.price : 0
}

export function mortgageValue(state: GameState, tileId: number): number {
  return Math.floor(priceOf(state, tileId) / 2)
}

export function unmortgageCost(state: GameState, tileId: number): number {
  return Math.round(mortgageValue(state, tileId) * 1.1)
}

export function groupHouseRange(
  state: GameState,
  group: ColorGroup
): { min: number; max: number } {
  const counts = groupIds(state, group).map((id) => state.tiles[id].houses)
  return { min: Math.min(...counts), max: Math.max(...counts) }
}

export function ownedTiles(state: GameState, playerId: string): number[] {
  return boardOf(state)
    .filter((def) => "price" in def && state.tiles[def.id].ownerId === playerId)
    .map((def) => def.id)
}

/** Balance plus everything sellable/mortgageable — the ceiling for paying a debt. */
export function maxRaisable(state: GameState, playerId: string): number {
  const player = playerById(state, playerId)
  if (!player) return 0
  let total = player.balance
  for (const def of boardOf(state)) {
    if (!("price" in def)) continue
    const tile = state.tiles[def.id]
    if (tile.ownerId !== playerId) continue
    if (def.type === "street" && tile.houses > 0) {
      total += tile.houses * Math.floor(def.houseCost / 2)
    }
    if (!tile.mortgaged) total += Math.floor(def.price / 2)
  }
  return total
}

export function netWorth(state: GameState, playerId: string): number {
  const player = playerById(state, playerId)
  if (!player) return 0
  let worth = player.balance
  for (const def of boardOf(state)) {
    if ("price" in def && state.tiles[def.id].ownerId === playerId) {
      worth += def.price
    }
  }
  return worth
}

export function historyPoint(state: GameState, turn: number): HistoryPoint {
  const point: HistoryPoint = { turn }
  for (const p of state.players) point[p.id] = netWorth(state, p.id)
  return point
}
