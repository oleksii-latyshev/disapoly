import { describe, expect, it } from "vitest"

import { nextRandom, rollDice, shuffle } from "../helpers/rng"

describe("rng", () => {
  it("nextRandom is deterministic for a given seed", () => {
    const a = nextRandom(123)
    const b = nextRandom(123)
    expect(a).toEqual(b)
    expect(a.value).toBeGreaterThanOrEqual(0)
    expect(a.value).toBeLessThan(1)
    expect(a.seed).not.toBe(123)
  })

  it("rollDice yields two dice in 1..6 and advances the seed", () => {
    for (let seed = 0; seed < 200; seed++) {
      const { dice, seed: next } = rollDice(seed)
      expect(dice[0]).toBeGreaterThanOrEqual(1)
      expect(dice[0]).toBeLessThanOrEqual(6)
      expect(dice[1]).toBeGreaterThanOrEqual(1)
      expect(dice[1]).toBeLessThanOrEqual(6)
      expect(next).not.toBe(seed)
    }
  })

  it("rollDice is deterministic for a given seed", () => {
    expect(rollDice(777)).toEqual(rollDice(777))
  })

  it("shuffle returns a deterministic permutation", () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const a = shuffle(items, 99)
    const b = shuffle(items, 99)
    expect(a.result).toEqual(b.result)
    expect([...a.result].sort((x, y) => x - y)).toEqual(items)
    // Original untouched.
    expect(items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})
