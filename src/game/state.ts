/** Initial-state construction and pure selectors over GameState. */

import {
  BOARD,
  GROUP_TILE_IDS,
  HOTELS_SUPPLY,
  HOUSES_SUPPLY,
  PLAYER_COLORS,
  RAILROAD_RENT,
  STARTING_BALANCE,
  UTILITY_MULTIPLIER,
} from "./board.config"
import { CHANCE, COMMUNITY_CHEST } from "./cards"
import { createSeed, shuffle } from "./rng"
import type {
  DeckState,
  GameState,
  HistoryPoint,
  Player,
  TileDefinition,
  TradeOffer,
} from "./types"

export type PlayerSetup = {
  /** Stable id; auto-generated for local hot-seat, supplied for online play. */
  id?: string
  nickname: string
  /** Token color; auto-assigned by join order when omitted. */
  color?: string
}

/** Build a fresh match state for the given players (2–8). */
export function createInitialState(
  setups: PlayerSetup[],
  seed: number = createSeed()
): GameState {
  const players: Player[] = setups.map((setup, index) => ({
    id: setup.id ?? `p${index + 1}`,
    nickname: setup.nickname.trim() || `Player ${index + 1}`,
    color: setup.color ?? PLAYER_COLORS[index % PLAYER_COLORS.length],
    balance: STARTING_BALANCE,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    isBankrupt: false,
  }))

  // Shuffle both decks from the seed, then keep the advanced seed for rolls.
  const range = (n: number) => Array.from({ length: n }, (_, i) => i)
  const ch = shuffle(range(CHANCE.length), seed)
  const cc = shuffle(range(COMMUNITY_CHEST.length), ch.seed)
  const chance: DeckState = { order: ch.result, pos: 0 }
  const chest: DeckState = { order: cc.result, pos: 0 }

  const state: GameState = {
    status: "playing",
    players,
    tiles: BOARD.map(() => ({ ownerId: null, houses: 0, mortgaged: false })),
    currentPlayerIndex: 0,
    phase: "awaiting-roll",
    dice: null,
    doublesCount: 0,
    pendingPurchase: null,
    auction: null,
    bank: { houses: HOUSES_SUPPLY, hotels: HOTELS_SUPPLY },
    rngSeed: cc.seed,
    chance,
    chest,
    lastCard: null,
    pendingTrade: null,
    turnCount: 0,
    history: [],
    log: [{ id: 0, key: "log.started", params: { n: players.length } }],
    nextLogId: 1,
    winnerId: null,
  }

  return { ...state, history: [historyPoint(state, 0)] }
}

/** Snapshot every player's net worth at a given turn. */
export function historyPoint(state: GameState, turn: number): HistoryPoint {
  const point: HistoryPoint = { turn }
  for (const p of state.players) point[p.id] = netWorth(state, p.id)
  return point
}

/** The tile definition at a board index. */
export function tileDef(id: number): TileDefinition {
  return BOARD[id]
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex]
}

export function playerById(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id)
}

/** True if `playerId` owns every tile in the street's color group (no mortgage). */
export function hasMonopoly(
  state: GameState,
  playerId: string,
  group: keyof typeof GROUP_TILE_IDS
): boolean {
  return GROUP_TILE_IDS[group].every((id) => {
    const tile = state.tiles[id]
    return tile.ownerId === playerId && !tile.mortgaged
  })
}

/** Count purchasable tiles of a given type owned by a player. */
export function countOwnedOfType(
  state: GameState,
  playerId: string,
  type: "railroad" | "utility"
): number {
  return BOARD.reduce(
    (n, tile) =>
      tile.type === type && state.tiles[tile.id].ownerId === playerId
        ? n + 1
        : n,
    0
  )
}

/**
 * Rent owed for landing on `tileId`, given the dice roll that brought the
 * player there (needed for utilities). Returns 0 if the tile is unowned,
 * mortgaged, or not rentable.
 */
export function rentFor(
  state: GameState,
  tileId: number,
  diceSum: number
): number {
  const def = tileDef(tileId)
  const tile = state.tiles[tileId]
  if (!tile.ownerId || tile.mortgaged) return 0

  if (def.type === "street") {
    if (tile.houses > 0) return def.rent[tile.houses]
    // Bare land: doubled when the owner holds the whole color group.
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

/**
 * Decision-support for the buy prompt: what a player stands to gain by buying
 * `tileId` right now. Pure and rendering-agnostic (the UI localizes it).
 */
export type PurchasePreview =
  | {
      kind: "street"
      baseRent: number
      /** Rent on bare land once the whole color group is held (×2). */
      rentWithSet: number
      owned: number // group tiles the player would own after buying
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
  const def = tileDef(tileId)
  if (def.type === "street") {
    const ids = GROUP_TILE_IDS[def.group]
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

// --- property management (Stage 2) ---

/** Price of a purchasable tile, or 0 for non-ownable tiles. */
export function priceOf(tileId: number): number {
  const def = tileDef(tileId)
  return "price" in def ? def.price : 0
}

export function mortgageValue(tileId: number): number {
  return Math.floor(priceOf(tileId) / 2)
}

/** Cost to lift a mortgage: the mortgage value plus 10% interest. */
export function unmortgageCost(tileId: number): number {
  return Math.round(mortgageValue(tileId) * 1.1)
}

/** Min and max houses currently built across a color group's tiles. */
export function groupHouseRange(
  state: GameState,
  group: keyof typeof GROUP_TILE_IDS
): { min: number; max: number } {
  const counts = GROUP_TILE_IDS[group].map((id) => state.tiles[id].houses)
  return { min: Math.min(...counts), max: Math.max(...counts) }
}

/**
 * Whether `playerId` may build a house/hotel on `tileId` right now: owns the
 * full color group, even-building holds, below the hotel cap, and can pay.
 */
export function canBuildHouse(
  state: GameState,
  playerId: string,
  tileId: number
): boolean {
  const def = tileDef(tileId)
  if (def.type !== "street") return false
  const tile = state.tiles[tileId]
  if (tile.ownerId !== playerId || tile.mortgaged) return false
  if (tile.houses >= 5) return false
  if (!hasMonopoly(state, playerId, def.group)) return false
  // Even building: never more than one ahead of the least-built tile.
  if (tile.houses !== groupHouseRange(state, def.group).min) return false
  // The bank must still stock the piece being placed (house, or hotel on the 5th).
  const needsHotel = tile.houses === 4
  if (needsHotel ? state.bank.hotels < 1 : state.bank.houses < 1) return false
  const player = playerById(state, playerId)
  return !!player && player.balance >= def.houseCost
}

/** Whether `playerId` may sell a house from `tileId` (even-selling rule). */
export function canSellHouse(
  state: GameState,
  playerId: string,
  tileId: number
): boolean {
  const def = tileDef(tileId)
  if (def.type !== "street") return false
  const tile = state.tiles[tileId]
  if (tile.ownerId !== playerId || tile.houses === 0) return false
  return tile.houses === groupHouseRange(state, def.group).max
}

/** Whether `playerId` may mortgage `tileId` (no buildings left in the group). */
export function canMortgage(
  state: GameState,
  playerId: string,
  tileId: number
): boolean {
  const def = tileDef(tileId)
  if (def.type !== "street" && def.type !== "railroad" && def.type !== "utility")
    return false
  const tile = state.tiles[tileId]
  if (tile.ownerId !== playerId || tile.mortgaged) return false
  if (def.type === "street" && groupHouseRange(state, def.group).max > 0)
    return false
  return true
}

/** Whether `playerId` may lift the mortgage on `tileId` (and afford it). */
export function canUnmortgage(
  state: GameState,
  playerId: string,
  tileId: number
): boolean {
  const def = tileDef(tileId)
  if (def.type !== "street" && def.type !== "railroad" && def.type !== "utility")
    return false
  const tile = state.tiles[tileId]
  if (tile.ownerId !== playerId || !tile.mortgaged) return false
  const player = playerById(state, playerId)
  return !!player && player.balance >= unmortgageCost(tileId)
}

/** Purchasable tiles owned by a player, in board order. */
export function ownedTiles(state: GameState, playerId: string): number[] {
  return BOARD.filter(
    (def) => "price" in def && state.tiles[def.id].ownerId === playerId
  ).map((def) => def.id)
}

// --- trading (Stage 3) ---

/** Tiles a player may put up for trade: owned, and the group has no buildings. */
export function tradableTiles(state: GameState, playerId: string): number[] {
  return ownedTiles(state, playerId).filter((id) => {
    const def = tileDef(id)
    if (def.type === "street") return groupHouseRange(state, def.group).max === 0
    return true
  })
}

/** Validate a trade offer against the current state (propose and apply time). */
export function isTradeValid(state: GameState, offer: TradeOffer): boolean {
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

  const empty = (b: TradeOffer["give"]) =>
    b.tiles.length === 0 && b.money === 0 && b.jailCards === 0
  // Reject a no-op exchange.
  return !(empty(offer.give) && empty(offer.receive))
}

/** Net worth = cash + price of owned tiles (Stage 0 ignores building value). */
export function netWorth(state: GameState, playerId: string): number {
  const player = playerById(state, playerId)
  if (!player) return 0
  let worth = player.balance
  for (const def of BOARD) {
    if ("price" in def && state.tiles[def.id].ownerId === playerId) {
      worth += def.price
    }
  }
  return worth
}

/** Players still in the game. */
export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.isBankrupt)
}
