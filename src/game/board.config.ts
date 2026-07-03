/**
 * Declarative board definition — the single source of truth for tile layout,
 * prices and rent. The rules engine reasons about `id`/`type` only; rendering
 * derives screen position from the id. See architecture.md §3.1 and §10.
 *
 * Layout follows the classic 40-tile board (US street names), indexed 0–39
 * clockwise starting from GO.
 */

import type { ColorGroup, TileDefinition } from "./types"

export const BOARD: readonly TileDefinition[] = [
  { id: 0, type: "go", name: "GO" },
  // brown
  {
    id: 1,
    type: "street",
    name: "Mediterranean Avenue",
    group: "brown",
    price: 60,
    rent: [2, 10, 30, 90, 160, 250],
    houseCost: 50,
  },
  { id: 2, type: "communityChest", name: "Community Chest" },
  {
    id: 3,
    type: "street",
    name: "Baltic Avenue",
    group: "brown",
    price: 60,
    rent: [4, 20, 60, 180, 320, 450],
    houseCost: 50,
  },
  { id: 4, type: "tax", name: "Income Tax", amount: 200 },
  { id: 5, type: "railroad", name: "Reading Railroad", price: 200 },
  // light blue
  {
    id: 6,
    type: "street",
    name: "Oriental Avenue",
    group: "lightBlue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
  },
  { id: 7, type: "chance", name: "Chance" },
  {
    id: 8,
    type: "street",
    name: "Vermont Avenue",
    group: "lightBlue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
  },
  {
    id: 9,
    type: "street",
    name: "Connecticut Avenue",
    group: "lightBlue",
    price: 120,
    rent: [8, 40, 100, 300, 450, 600],
    houseCost: 50,
  },
  { id: 10, type: "jail", name: "Jail / Just Visiting" },
  // pink
  {
    id: 11,
    type: "street",
    name: "St. Charles Place",
    group: "pink",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
  },
  { id: 12, type: "utility", name: "Electric Company", price: 150 },
  {
    id: 13,
    type: "street",
    name: "States Avenue",
    group: "pink",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
  },
  {
    id: 14,
    type: "street",
    name: "Virginia Avenue",
    group: "pink",
    price: 160,
    rent: [12, 60, 180, 500, 700, 900],
    houseCost: 100,
  },
  { id: 15, type: "railroad", name: "Pennsylvania Railroad", price: 200 },
  // orange
  {
    id: 16,
    type: "street",
    name: "St. James Place",
    group: "orange",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
  },
  { id: 17, type: "communityChest", name: "Community Chest" },
  {
    id: 18,
    type: "street",
    name: "Tennessee Avenue",
    group: "orange",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
  },
  {
    id: 19,
    type: "street",
    name: "New York Avenue",
    group: "orange",
    price: 200,
    rent: [16, 80, 220, 600, 800, 1000],
    houseCost: 100,
  },
  { id: 20, type: "freeParking", name: "Free Parking" },
  // red
  {
    id: 21,
    type: "street",
    name: "Kentucky Avenue",
    group: "red",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
  },
  { id: 22, type: "chance", name: "Chance" },
  {
    id: 23,
    type: "street",
    name: "Indiana Avenue",
    group: "red",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
  },
  {
    id: 24,
    type: "street",
    name: "Illinois Avenue",
    group: "red",
    price: 240,
    rent: [20, 100, 300, 750, 925, 1100],
    houseCost: 150,
  },
  { id: 25, type: "railroad", name: "B&O Railroad", price: 200 },
  // yellow
  {
    id: 26,
    type: "street",
    name: "Atlantic Avenue",
    group: "yellow",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
  },
  {
    id: 27,
    type: "street",
    name: "Ventnor Avenue",
    group: "yellow",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
  },
  { id: 28, type: "utility", name: "Water Works", price: 150 },
  {
    id: 29,
    type: "street",
    name: "Marvin Gardens",
    group: "yellow",
    price: 280,
    rent: [24, 120, 360, 850, 1025, 1200],
    houseCost: 150,
  },
  { id: 30, type: "goToJail", name: "Go To Jail" },
  // green
  {
    id: 31,
    type: "street",
    name: "Pacific Avenue",
    group: "green",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
  },
  {
    id: 32,
    type: "street",
    name: "North Carolina Avenue",
    group: "green",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
  },
  { id: 33, type: "communityChest", name: "Community Chest" },
  {
    id: 34,
    type: "street",
    name: "Pennsylvania Avenue",
    group: "green",
    price: 320,
    rent: [28, 150, 450, 1000, 1200, 1400],
    houseCost: 200,
  },
  { id: 35, type: "railroad", name: "Short Line Railroad", price: 200 },
  // dark blue
  { id: 36, type: "chance", name: "Chance" },
  {
    id: 37,
    type: "street",
    name: "Park Place",
    group: "darkBlue",
    price: 350,
    rent: [35, 175, 500, 1100, 1300, 1500],
    houseCost: 200,
  },
  { id: 38, type: "tax", name: "Luxury Tax", amount: 100 },
  {
    id: 39,
    type: "street",
    name: "Boardwalk",
    group: "darkBlue",
    price: 400,
    rent: [50, 200, 600, 1400, 1700, 2000],
    houseCost: 200,
  },
] as const

export const BOARD_SIZE = BOARD.length // 40
export const GO_PAYOUT = 200
export const STARTING_BALANCE = 1500
export const JAIL_TILE_ID = 10
export const JAIL_FINE = 50

/** The bank's finite building supply (classic scarcity: build only if in stock). */
export const HOUSES_SUPPLY = 32
export const HOTELS_SUPPLY = 12

/** Rent for a railroad by the number the owner holds (1–4). */
export const RAILROAD_RENT = [25, 50, 100, 200] as const

/** Dice multiplier for a utility by the number the owner holds (1–2). */
export const UTILITY_MULTIPLIER = [4, 10] as const

/** Tile ids that belong to each color group — used for monopoly checks. */
export const GROUP_TILE_IDS: Record<ColorGroup, number[]> = (() => {
  const groups = {} as Record<ColorGroup, number[]>
  for (const tile of BOARD) {
    if (tile.type === "street") {
      ;(groups[tile.group] ??= []).push(tile.id)
    }
  }
  return groups
})()

/** Token colors offered to players in the order they join. */
export const PLAYER_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#a855f7", // purple
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
] as const
