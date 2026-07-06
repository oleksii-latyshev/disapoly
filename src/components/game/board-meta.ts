/** Visual metadata for rendering the board: grid placement and group colors. */

import {
  boardOf,
  boardSizeOf,
  jailTileId,
  type ColorGroup,
  type GameState,
  type Player,
} from "@/game"

/** Cells per grid edge for a board of `size` tiles (11 classic, 13 large). */
export function gridSide(size: number): number {
  return size / 4 + 1
}

/**
 * Map a tile id to its cell in the board's CSS grid (11×11 for 40 tiles,
 * 13×13 for 48). The perimeter runs clockwise from GO at the bottom-right.
 */
export function tileCell(
  id: number,
  size: number
): { row: number; col: number } {
  const side = size / 4
  const n = side + 1
  if (id === 0) return { row: n, col: n }
  if (id < side) return { row: n, col: n - id } // bottom edge
  if (id === side) return { row: n, col: 1 }
  if (id < 2 * side) return { row: n + side - id, col: 1 } // left edge
  if (id === 2 * side) return { row: 1, col: 1 }
  if (id < 3 * side) return { row: 1, col: id - (2 * side - 1) } // top edge
  if (id === 3 * side) return { row: 1, col: n }
  return { row: id - (3 * side - 1), col: n } // right edge
}

/** Is this tile on a vertical edge (left/right columns)? Used for sizing. */
export function isVerticalEdge(id: number, size: number): boolean {
  const side = size / 4
  return (id > side && id < 2 * side) || (id > 3 * side && id < size)
}

/** Center of a tile as percentages of the board (for the token layer). */
export function tileCenter(id: number, size: number): { x: number; y: number } {
  const n = gridSide(size)
  const { row, col } = tileCell(id, size)
  return { x: ((col - 0.5) / n) * 100, y: ((row - 0.5) / n) * 100 }
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
export function tokenTargets(
  players: Player[],
  size: number
): Map<string, TokenTarget> {
  const counters: Record<number, number> = {}
  const targets = new Map<string, TokenTarget>()
  for (const player of players) {
    const seen = counters[player.position] ?? 0
    counters[player.position] = seen + 1
    const [dx, dy] = TOKEN_OFFSETS[Math.min(seen, TOKEN_OFFSETS.length - 1)]
    const c = tileCenter(player.position, size)
    targets.set(player.id, { x: c.x + dx, y: c.y + dy })
  }
  return targets
}

/**
 * How long the token layer animates a move from `from` to `to` (seconds) —
 * per-tile hops for forward rolls, a single glide for teleports. Must stay in
 * sync with the travel animation in TokenLayer.
 */
export function travelSeconds(from: number, to: number, size: number): number {
  const forward = (to - from + size) % size
  if (forward >= 1 && forward <= 12) return Math.min(0.2 * forward, 2.2)
  return 0.75
}

/** Snapshot of every player's position, for diffing across state updates. */
export function positionsOf(players: Player[]): Map<string, number> {
  return new Map(players.map((p) => [p.id, p.position]))
}

/** Small beat added after a token lands before reactive UI fires. */
const LANDING_BEAT_MS = 250

/**
 * How long a token pauses on the Chance/Chest tile while the drawn card is
 * revealed, before travelling on to the card's destination. Long enough for
 * the slot-machine spin (~2s) to settle and be read.
 */
export const STOPOVER_PAUSE_MS = 2400

/** Shorter beat on the "Go To Jail" corner before the piece is hauled off. */
export const JAIL_STOPOVER_PAUSE_MS = 900

export type Stopover = { tile: number; pauseMs: number }

/**
 * If a single state update carried the acting player *past* the tile their
 * roll actually landed on, return that tile so the token visibly stops there
 * first. Two cases: a movement card (pause for the reveal) and the "Go To
 * Jail" corner (a beat before being hauled to jail). `from` is the mover's
 * position before the update.
 */
export function travelStopover(
  state: GameState,
  from: number
): Stopover | null {
  if (!state.dice) return null
  const mover = state.players[state.currentPlayerIndex]
  if (!mover) return null
  const board = boardOf(state)
  const rolledTo = (from + state.dice[0] + state.dice[1]) % board.length
  if (rolledTo === mover.position) return null

  if (state.lastCard) {
    const deckType =
      state.lastCard.deck === "chance" ? "chance" : "communityChest"
    if (board[rolledTo].type === deckType) {
      return { tile: rolledTo, pauseMs: STOPOVER_PAUSE_MS }
    }
  }
  if (
    mover.inJail &&
    mover.position === jailTileId(state) &&
    board[rolledTo].type === "goToJail"
  ) {
    return { tile: rolledTo, pauseMs: JAIL_STOPOVER_PAUSE_MS }
  }
  return null
}

/**
 * Timing plan for reactive UI after a state update, derived from how the
 * tokens will animate:
 *  - `cardRevealMs` — when a drawn card should flip (the drawer's token has
 *    reached the tile it was drawn on);
 *  - `totalMs` — when *all* movement (including a post-reveal onward leg) is
 *    done: callouts, money deltas and landing sounds wait for this.
 * Both are 0 when nobody moved, so stationary events stay instant.
 */
export type TravelPlan = { cardRevealMs: number; totalMs: number }

export function travelPlan(
  prev: Map<string, number> | null,
  state: GameState
): TravelPlan {
  if (!prev) return { cardRevealMs: 0, totalMs: 0 }

  const size = boardSizeOf(state)
  let maxMs = 0
  for (const p of state.players) {
    const before = prev.get(p.id)
    if (before === undefined || before === p.position) continue
    maxMs = Math.max(
      maxMs,
      Math.round(travelSeconds(before, p.position, size) * 1000)
    )
  }
  if (maxMs === 0) return { cardRevealMs: 0, totalMs: 0 }

  // A stop-over (movement card, Go To Jail) splits the travel in two legs.
  const mover = state.players[state.currentPlayerIndex]
  const before = mover ? prev.get(mover.id) : undefined
  if (mover && before !== undefined && before !== mover.position) {
    const stop = travelStopover(state, before)
    if (stop !== null) {
      const leg1 = Math.round(travelSeconds(before, stop.tile, size) * 1000)
      const leg2 = Math.round(
        travelSeconds(stop.tile, mover.position, size) * 1000
      )
      return {
        cardRevealMs: leg1 + LANDING_BEAT_MS,
        totalMs: Math.max(maxMs, leg1 + stop.pauseMs + leg2) + LANDING_BEAT_MS,
      }
    }
  }

  return {
    cardRevealMs: maxMs + LANDING_BEAT_MS,
    totalMs: maxMs + LANDING_BEAT_MS,
  }
}

// Kept in step with the Classic palette in board-theme.tsx (VIVID): the
// brown/orange/yellow lightness ladder aids low color vision.
export const GROUP_COLOR: Record<ColorGroup, string> = {
  brown: "#54341a",
  teal: "#14b8a6",
  lightBlue: "#7dd3fc",
  pink: "#f472b6",
  orange: "#f97316",
  red: "#dc2626",
  yellow: "#fde047",
  violet: "#8b5cf6",
  green: "#16a34a",
  darkBlue: "#1e3a8a",
}
