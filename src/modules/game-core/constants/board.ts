// Declarative board data — the single source of truth for tile layout,
// prices and rent. The rules engine reasons about id/type only; rendering
// derives screen position from the id.

import type { BankSupply, BoardId, ColorGroup, TileDefinition } from "../types"

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

/**
 * The large board (48 tiles, host-selectable for big games): the classic 40
 * plus two extra color groups — teal (bottom) and violet (top) — and a third
 * dark-blue street, so up to 10 street monopolies exist for 6–8 players.
 * Indexed 0–47 clockwise from GO; corners at 0 / 12 / 24 / 36.
 */
export const LARGE_BOARD: readonly TileDefinition[] = [
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
  // teal (new)
  {
    id: 5,
    type: "street",
    name: "Shoreline Drive",
    group: "teal",
    price: 80,
    rent: [5, 25, 75, 225, 350, 500],
    houseCost: 50,
  },
  {
    id: 6,
    type: "street",
    name: "Harbor Lane",
    group: "teal",
    price: 80,
    rent: [5, 25, 75, 225, 350, 500],
    houseCost: 50,
  },
  {
    id: 7,
    type: "street",
    name: "Beacon Street",
    group: "teal",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
  },
  { id: 8, type: "railroad", name: "Reading Railroad", price: 200 },
  // light blue
  {
    id: 9,
    type: "street",
    name: "Oriental Avenue",
    group: "lightBlue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
  },
  {
    id: 10,
    type: "street",
    name: "Vermont Avenue",
    group: "lightBlue",
    price: 100,
    rent: [6, 30, 90, 270, 400, 550],
    houseCost: 50,
  },
  {
    id: 11,
    type: "street",
    name: "Connecticut Avenue",
    group: "lightBlue",
    price: 120,
    rent: [8, 40, 100, 300, 450, 600],
    houseCost: 50,
  },
  { id: 12, type: "jail", name: "Jail / Just Visiting" },
  // pink
  {
    id: 13,
    type: "street",
    name: "St. Charles Place",
    group: "pink",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
  },
  { id: 14, type: "utility", name: "Electric Company", price: 150 },
  {
    id: 15,
    type: "street",
    name: "States Avenue",
    group: "pink",
    price: 140,
    rent: [10, 50, 150, 450, 625, 750],
    houseCost: 100,
  },
  {
    id: 16,
    type: "street",
    name: "Virginia Avenue",
    group: "pink",
    price: 160,
    rent: [12, 60, 180, 500, 700, 900],
    houseCost: 100,
  },
  { id: 17, type: "railroad", name: "Pennsylvania Railroad", price: 200 },
  // orange
  {
    id: 18,
    type: "street",
    name: "St. James Place",
    group: "orange",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
  },
  { id: 19, type: "communityChest", name: "Community Chest" },
  {
    id: 20,
    type: "street",
    name: "Tennessee Avenue",
    group: "orange",
    price: 180,
    rent: [14, 70, 200, 550, 750, 950],
    houseCost: 100,
  },
  {
    id: 21,
    type: "street",
    name: "New York Avenue",
    group: "orange",
    price: 200,
    rent: [16, 80, 220, 600, 800, 1000],
    houseCost: 100,
  },
  { id: 22, type: "chance", name: "Chance" },
  { id: 23, type: "utility", name: "Water Works", price: 150 },
  { id: 24, type: "freeParking", name: "Free Parking" },
  // red
  {
    id: 25,
    type: "street",
    name: "Kentucky Avenue",
    group: "red",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
  },
  { id: 26, type: "chance", name: "Chance" },
  {
    id: 27,
    type: "street",
    name: "Indiana Avenue",
    group: "red",
    price: 220,
    rent: [18, 90, 250, 700, 875, 1050],
    houseCost: 150,
  },
  {
    id: 28,
    type: "street",
    name: "Illinois Avenue",
    group: "red",
    price: 240,
    rent: [20, 100, 300, 750, 925, 1100],
    houseCost: 150,
  },
  { id: 29, type: "railroad", name: "B&O Railroad", price: 200 },
  // yellow
  {
    id: 30,
    type: "street",
    name: "Atlantic Avenue",
    group: "yellow",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
  },
  {
    id: 31,
    type: "street",
    name: "Ventnor Avenue",
    group: "yellow",
    price: 260,
    rent: [22, 110, 330, 800, 975, 1150],
    houseCost: 150,
  },
  {
    id: 32,
    type: "street",
    name: "Marvin Gardens",
    group: "yellow",
    price: 280,
    rent: [24, 120, 360, 850, 1025, 1200],
    houseCost: 150,
  },
  // violet (new)
  {
    id: 33,
    type: "street",
    name: "Orchid Terrace",
    group: "violet",
    price: 290,
    rent: [25, 125, 375, 875, 1050, 1250],
    houseCost: 150,
  },
  {
    id: 34,
    type: "street",
    name: "Lavender Row",
    group: "violet",
    price: 290,
    rent: [25, 125, 375, 875, 1050, 1250],
    houseCost: 150,
  },
  {
    id: 35,
    type: "street",
    name: "Amethyst Avenue",
    group: "violet",
    price: 310,
    rent: [27, 135, 405, 925, 1125, 1300],
    houseCost: 150,
  },
  { id: 36, type: "goToJail", name: "Go To Jail" },
  // green
  {
    id: 37,
    type: "street",
    name: "Pacific Avenue",
    group: "green",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
  },
  {
    id: 38,
    type: "street",
    name: "North Carolina Avenue",
    group: "green",
    price: 300,
    rent: [26, 130, 390, 900, 1100, 1275],
    houseCost: 200,
  },
  { id: 39, type: "communityChest", name: "Community Chest" },
  {
    id: 40,
    type: "street",
    name: "Pennsylvania Avenue",
    group: "green",
    price: 320,
    rent: [28, 150, 450, 1000, 1200, 1400],
    houseCost: 200,
  },
  { id: 41, type: "railroad", name: "Short Line Railroad", price: 200 },
  { id: 42, type: "chance", name: "Chance" },
  // dark blue (three streets on the large board)
  {
    id: 43,
    type: "street",
    name: "Park Place",
    group: "darkBlue",
    price: 350,
    rent: [35, 175, 500, 1100, 1300, 1500],
    houseCost: 200,
  },
  {
    id: 44,
    type: "street",
    name: "Fifth Avenue",
    group: "darkBlue",
    price: 380,
    rent: [40, 190, 550, 1250, 1500, 1750],
    houseCost: 200,
  },
  { id: 45, type: "communityChest", name: "Community Chest" },
  { id: 46, type: "tax", name: "Luxury Tax", amount: 100 },
  {
    id: 47,
    type: "street",
    name: "Boardwalk",
    group: "darkBlue",
    price: 400,
    rent: [50, 200, 600, 1400, 1700, 2000],
    houseCost: 200,
  },
] as const

/** Every playable board, by id. */
export const BOARDS: Record<BoardId, readonly TileDefinition[]> = {
  classic: BOARD,
  large: LARGE_BOARD,
}

export const BOARD_SIZE = BOARD.length // 40
export const GO_PAYOUT = 200
export const STARTING_BALANCE = 1500
export const JAIL_TILE_ID = 10
export const JAIL_FINE = 50

/** The bank's finite building supply (classic scarcity: build only if in stock). */
export const HOUSES_SUPPLY = 32
export const HOTELS_SUPPLY = 12

/** Building supply per board — the large board stocks proportionally more. */
export const BANK_SUPPLY: Record<BoardId, BankSupply> = {
  classic: { houses: HOUSES_SUPPLY, hotels: HOTELS_SUPPLY },
  large: { houses: 42, hotels: 16 },
}

/** The board a match with these settings is played on. */
export function boardFor(boardId?: BoardId): readonly TileDefinition[] {
  return BOARDS[boardId ?? "classic"]
}

/** Where the jail corner sits on a board. */
export function jailTileIdOf(board: readonly TileDefinition[]): number {
  return board.find((t) => t.type === "jail")!.id
}

// Group→tile-ids lookup, derived once per board.
const groupIdsCache = new Map<
  readonly TileDefinition[],
  Record<ColorGroup, number[]>
>()

/** Tile ids of each color group on a board — used for monopoly checks. */
export function groupTileIdsOf(
  board: readonly TileDefinition[]
): Record<ColorGroup, number[]> {
  let groups = groupIdsCache.get(board)
  if (!groups) {
    groups = {} as Record<ColorGroup, number[]>
    for (const tile of board) {
      if (tile.type === "street") {
        ;(groups[tile.group] ??= []).push(tile.id)
      }
    }
    groupIdsCache.set(board, groups)
  }
  return groups
}

/** Named card destinations, resolvable on any board. */
export type MoveTarget =
  "go" | "illinois" | "stCharles" | "reading" | "boardwalk"

const MOVE_TARGET_NAME: Record<Exclude<MoveTarget, "go">, string> = {
  illinois: "Illinois Avenue",
  stCharles: "St. Charles Place",
  reading: "Reading Railroad",
  boardwalk: "Boardwalk",
}

/** Resolve a card's named destination to a tile id on the given board. */
export function moveTargetTile(
  board: readonly TileDefinition[],
  target: MoveTarget
): number {
  if (target === "go") return 0
  const name = MOVE_TARGET_NAME[target]
  return board.find((t) => t.name === name)!.id
}

/** Rent for a railroad by the number the owner holds (1–4). */
export const RAILROAD_RENT = [25, 50, 100, 200] as const

/** Dice multiplier for a utility by the number the owner holds (1–2). */
export const UTILITY_MULTIPLIER = [4, 10] as const

/** Emoji avatars offered to players; auto-assigned by join order, pickable. */
export const PLAYER_EMOJIS: readonly string[] = [
  "🦊",
  "🐼",
  "🐸",
  "🦁",
  "🐙",
  "🦄",
  "🐯",
  "🐨",
  "🐷",
  "🐵",
  "🦖",
  "🐳",
  "🦉",
  "🐝",
  "🦀",
  "🐰",
]

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
