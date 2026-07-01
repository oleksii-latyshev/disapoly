/** Visual metadata for rendering the board: grid placement and group colors. */

import type { ColorGroup, Player } from "@/game"

/**
 * Map a tile id (0–39) to its cell in an 11×11 CSS grid. The perimeter runs
 * clockwise from GO at the bottom-right corner.
 */
export function tileCell(id: number): { row: number; col: number } {
  if (id === 0) return { row: 11, col: 11 }
  if (id < 10) return { row: 11, col: 11 - id } // bottom edge
  if (id === 10) return { row: 11, col: 1 }
  if (id < 20) return { row: 21 - id, col: 1 } // left edge
  if (id === 20) return { row: 1, col: 1 }
  if (id < 30) return { row: 1, col: id - 19 } // top edge
  if (id === 30) return { row: 1, col: 11 }
  return { row: id - 29, col: 11 } // right edge (31–39)
}

/** Is this tile on a vertical edge (left/right columns)? Used for sizing. */
export function isVerticalEdge(id: number): boolean {
  return (id > 10 && id < 20) || (id > 30 && id < 40)
}

/** Center of a tile as percentages of the 11×11 board (for the token layer). */
export function tileCenter(id: number): { x: number; y: number } {
  const { row, col } = tileCell(id)
  return { x: ((col - 0.5) / 11) * 100, y: ((row - 0.5) / 11) * 100 }
}

/** Small fan-out offsets (in % of board) when several tokens share a tile. */
const TOKEN_OFFSETS: [number, number][] = [
  [0, 0],
  [-1.7, -1.7],
  [1.7, -1.7],
  [-1.7, 1.7],
  [1.7, 1.7],
  [0, -2],
  [0, 2],
  [-2, 0],
]

export type TokenTarget = { x: number; y: number }

/**
 * Screen position (% of board) of each player's token, fanning out co-located
 * tokens so they don't fully overlap. Shared by the token layer and any overlay
 * that needs to anchor to a token (e.g. reactions).
 */
export function tokenTargets(players: Player[]): Map<string, TokenTarget> {
  const counters: Record<number, number> = {}
  const targets = new Map<string, TokenTarget>()
  for (const player of players) {
    const seen = counters[player.position] ?? 0
    counters[player.position] = seen + 1
    const [dx, dy] = TOKEN_OFFSETS[Math.min(seen, TOKEN_OFFSETS.length - 1)]
    const c = tileCenter(player.position)
    targets.set(player.id, { x: c.x + dx, y: c.y + dy })
  }
  return targets
}

export const GROUP_COLOR: Record<ColorGroup, string> = {
  brown: "#92400e",
  lightBlue: "#7dd3fc",
  pink: "#ec4899",
  orange: "#f97316",
  red: "#ef4444",
  yellow: "#eab308",
  green: "#16a34a",
  darkBlue: "#1e3a8a",
}
