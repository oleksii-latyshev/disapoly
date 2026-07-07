// mulberry32 — all game randomness flows through one seed so every client
// (and the server) derives identical results.

/** Advance a 32-bit seed and return the next seed plus a float in [0, 1). */
export function nextRandom(seed: number): { seed: number; value: number } {
  let t = (seed + 0x6d2b79f5) | 0
  const nextSeed = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { seed: nextSeed, value }
}

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

export function createSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) | 0) >>> 0
}

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
