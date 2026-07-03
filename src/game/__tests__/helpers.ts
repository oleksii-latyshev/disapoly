/** Shared helpers for game-core tests. */

import { rollDice } from "../rng"
import { createInitialState, type PlayerSetup } from "../state"
import type { GameState } from "../types"

/**
 * Fresh match with `n` players (ids `p1`…`pn`) and a fixed seed so every test
 * is reproducible. Tests freely mutate the returned state to stage scenarios —
 * the reducer clones before applying, so staged objects are never aliased.
 */
export function newGame(n = 2, seed = 42): GameState {
  const setups: PlayerSetup[] = Array.from({ length: n }, (_, i) => ({
    nickname: `P${i + 1}`,
  }))
  return createInitialState(setups, seed)
}

/** Find an `rngSeed` whose next roll is exactly `[a, b]` (dice are seeded). */
export function seedForDice(a: number, b: number): number {
  for (let seed = 0; seed < 1_000_000; seed++) {
    const { dice } = rollDice(seed)
    if (dice[0] === a && dice[1] === b) return seed
  }
  throw new Error(`no seed found for dice [${a}, ${b}]`)
}

/** Stage the state so the next ROLL_DICE produces exactly `[a, b]`. */
export function withNextRoll(
  state: GameState,
  a: number,
  b: number
): GameState {
  return { ...state, rngSeed: seedForDice(a, b) }
}

/** Hand tiles to a player (bank-owned otherwise). Mutates in place. */
export function give(
  state: GameState,
  playerId: string,
  ...tileIds: number[]
): void {
  for (const id of tileIds) state.tiles[id].ownerId = playerId
}

export function player(state: GameState, id: string) {
  const found = state.players.find((p) => p.id === id)
  if (!found) throw new Error(`no player ${id}`)
  return found
}
