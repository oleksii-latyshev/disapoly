/**
 * Deterministic, seedable PRNG (mulberry32).
 *
 * All randomness in the game (dice, later cards) must flow through a single
 * seed so results are reproducible and verifiable across clients once the sync
 * layer exists. See architecture.md §3.3 / §4 ("Fair RNG").
 */

/** Advance a 32-bit seed and return the next seed plus a float in [0, 1). */
export function nextRandom(seed: number): { seed: number; value: number } {
  let t = (seed + 0x6d2b79f5) | 0
  const nextSeed = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { seed: nextSeed, value }
}

/** Roll two six-sided dice from a seed, returning the advanced seed. */
export function rollDice(seed: number): {
  seed: number
  dice: [number, number]
} {
  const first = nextRandom(seed)
  const second = nextRandom(first.seed)
  return {
    seed: second.seed,
    dice: [1 + Math.floor(first.value * 6), 1 + Math.floor(second.value * 6)],
  }
}

/** A reasonable random initial seed for a fresh local match. */
export function createSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) | 0) >>> 0
}

/** Deterministic Fisher–Yates shuffle; returns the result and advanced seed. */
export function shuffle<T>(
  items: readonly T[],
  seed: number
): { result: T[]; seed: number } {
  const result = [...items]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    const next = nextRandom(s)
    s = next.seed
    const j = Math.floor(next.value * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return { result, seed: s }
}
