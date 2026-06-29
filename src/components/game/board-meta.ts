/** Visual metadata for rendering the board: grid placement and group colors. */

import type { ColorGroup } from "@/game"

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
