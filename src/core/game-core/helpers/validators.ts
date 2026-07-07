import type { GameState, Player, TradeOffer, TradeProposal } from "../types"
import {
  groupHouseRange,
  hasMonopoly,
  ownedTiles,
  playerById,
  tileDef,
  unmortgageCost,
} from "./selectors"

export function canBuildHouse(
  state: GameState,
  playerId: string,
  tileId: number
): boolean {
  const def = tileDef(state, tileId)
  if (def.type !== "street") return false
  const tile = state.tiles[tileId]
  if (tile.ownerId !== playerId || tile.mortgaged) return false
  if (tile.houses >= 5) return false
  if (!hasMonopoly(state, playerId, def.group)) return false
  // Even-building rule: never more than one ahead of the least-built tile.
  if (tile.houses !== groupHouseRange(state, def.group).min) return false
  const needsHotel = tile.houses === 4
  if (needsHotel ? state.bank.hotels < 1 : state.bank.houses < 1) return false
  const player = playerById(state, playerId)
  return !!player && player.balance >= def.houseCost
}

export function canSellHouse(
  state: GameState,
  playerId: string,
  tileId: number
): boolean {
  const def = tileDef(state, tileId)
  if (def.type !== "street") return false
  const tile = state.tiles[tileId]
  if (tile.ownerId !== playerId || tile.houses === 0) return false
  return tile.houses === groupHouseRange(state, def.group).max
}

export function canMortgage(
  state: GameState,
  playerId: string,
  tileId: number
): boolean {
  const def = tileDef(state, tileId)
  if (
    def.type !== "street" &&
    def.type !== "railroad" &&
    def.type !== "utility"
  )
    return false
  const tile = state.tiles[tileId]
  if (tile.ownerId !== playerId || tile.mortgaged) return false
  if (def.type === "street" && groupHouseRange(state, def.group).max > 0)
    return false
  return true
}

export function canUnmortgage(
  state: GameState,
  playerId: string,
  tileId: number
): boolean {
  const def = tileDef(state, tileId)
  if (
    def.type !== "street" &&
    def.type !== "railroad" &&
    def.type !== "utility"
  )
    return false
  const tile = state.tiles[tileId]
  if (tile.ownerId !== playerId || !tile.mortgaged) return false
  const player = playerById(state, playerId)
  return !!player && player.balance >= unmortgageCost(state, tileId)
}

export function tradableTiles(state: GameState, playerId: string): number[] {
  return ownedTiles(state, playerId).filter((id) => {
    const def = tileDef(state, id)
    if (def.type === "street")
      return groupHouseRange(state, def.group).max === 0
    return true
  })
}

/** Checked both when an offer is proposed and again when it is accepted. */
export function isTradeValid(state: GameState, offer: TradeProposal): boolean {
  const from = playerById(state, offer.fromId)
  const to = playerById(state, offer.toId)
  if (!from || !to || from.id === to.id || from.isBankrupt || to.isBankrupt)
    return false

  const bundleOk = (
    bundle: TradeOffer["give"],
    owner: Player,
    partner: Player
  ): boolean => {
    if (bundle.money < 0 || bundle.jailCards < 0) return false
    if (bundle.money > owner.balance) return false
    if (bundle.jailCards > owner.getOutOfJailCards) return false
    const tradable = new Set(tradableTiles(state, owner.id))
    return bundle.tiles.every((id) => tradable.has(id)) && partner != null
  }

  if (!bundleOk(offer.give, from, to)) return false
  if (!bundleOk(offer.receive, to, from)) return false

  const isEmpty = (b: TradeOffer["give"]) =>
    b.tiles.length === 0 && b.money === 0 && b.jailCards === 0
  return !(isEmpty(offer.give) && isEmpty(offer.receive))
}
