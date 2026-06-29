/** Initial-state construction and pure selectors over GameState. */

import {
  BOARD,
  GROUP_TILE_IDS,
  PLAYER_COLORS,
  RAILROAD_RENT,
  STARTING_BALANCE,
  UTILITY_MULTIPLIER,
} from "./board.config"
import { createSeed } from "./rng"
import type { GameState, Player, TileDefinition } from "./types"

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
    isBankrupt: false,
  }))

  return {
    status: "playing",
    players,
    tiles: BOARD.map(() => ({ ownerId: null, houses: 0, mortgaged: false })),
    currentPlayerIndex: 0,
    phase: "awaiting-roll",
    dice: null,
    doublesCount: 0,
    pendingPurchase: null,
    rngSeed: seed,
    log: [{ id: 0, text: `Game started with ${players.length} players.` }],
    nextLogId: 1,
    winnerId: null,
  }
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
