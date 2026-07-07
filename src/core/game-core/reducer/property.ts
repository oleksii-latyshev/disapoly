import { returnBuilding, takeBuilding } from "../helpers/buildings"
import { log } from "../helpers/log"
import {
  currentPlayer,
  mortgageValue,
  tileDef,
  unmortgageCost,
} from "../helpers/selectors"
import {
  canBuildHouse,
  canMortgage,
  canSellHouse,
  canUnmortgage,
} from "../helpers/validators"
import type { GameState, StreetTile } from "../types"

export function buildHouse(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canBuildHouse(d, player.id, tileId)) return d
  const def = tileDef(d, tileId) as StreetTile
  player.balance -= def.houseCost
  takeBuilding(d, tileId)
  log(d, d.tiles[tileId].houses === 5 ? "log.builtHotel" : "log.builtHouse", {
    name: player.nickname,
    tile: def.name,
    cost: def.houseCost,
  })
  return d
}

export function sellHouse(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canSellHouse(d, player.id, tileId)) return d
  const def = tileDef(d, tileId) as StreetTile
  const refund = Math.floor(def.houseCost / 2)
  returnBuilding(d, tileId)
  player.balance += refund
  log(d, "log.soldBuilding", { name: player.nickname, tile: def.name, refund })
  return d
}

export function mortgage(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canMortgage(d, player.id, tileId)) return d
  const value = mortgageValue(d, tileId)
  d.tiles[tileId].mortgaged = true
  player.balance += value
  log(d, "log.mortgaged", {
    name: player.nickname,
    tile: tileDef(d, tileId).name,
    value,
  })
  return d
}

export function unmortgage(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canUnmortgage(d, player.id, tileId)) return d
  const cost = unmortgageCost(d, tileId)
  d.tiles[tileId].mortgaged = false
  player.balance -= cost
  log(d, "log.unmortgaged", {
    name: player.nickname,
    tile: tileDef(d, tileId).name,
    cost,
  })
  return d
}
