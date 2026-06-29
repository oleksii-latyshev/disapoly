/**
 * Core game model types for Disapoly (Stage 0 — local hot-seat).
 *
 * The model is fully decoupled from rendering and networking: it is a plain,
 * JSON-serializable state plus a pure reducer. Later stages reuse it as-is and
 * only add a sync layer on top.
 */

/** Color groups for purchasable street properties. */
export type ColorGroup =
  | "brown"
  | "lightBlue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkBlue"

/** Static, immutable definition of a single tile on the board. */
export type TileDefinition =
  | StreetTile
  | RailroadTile
  | UtilityTile
  | { id: number; type: "go"; name: string }
  | { id: number; type: "jail"; name: string }
  | { id: number; type: "goToJail"; name: string }
  | { id: number; type: "freeParking"; name: string }
  | { id: number; type: "tax"; name: string; amount: number }
  | { id: number; type: "chance"; name: string }
  | { id: number; type: "communityChest"; name: string }

export type StreetTile = {
  id: number
  type: "street"
  name: string
  group: ColorGroup
  price: number
  /** Rent by building level: [base, 1 house, 2, 3, 4, hotel]. */
  rent: [number, number, number, number, number, number]
  /** Cost to build one house (a hotel costs the same as the 5th house). */
  houseCost: number
}

export type RailroadTile = {
  id: number
  type: "railroad"
  name: string
  price: number
}

export type UtilityTile = {
  id: number
  type: "utility"
  name: string
  price: number
}

/** A purchasable tile is one of these three types. */
export type OwnableType = "street" | "railroad" | "utility"

/** Mutable per-tile state that changes during a match. */
export type TileState = {
  /** playerId of the owner, or null if owned by the bank. */
  ownerId: string | null
  /** Houses built (0–4); 5 represents a hotel. Streets only. */
  houses: number
  /** Mortgaged tiles collect no rent. Reserved for later stages. */
  mortgaged: boolean
}

export type Player = {
  id: string
  nickname: string
  /** CSS color used to render the token and ownership marks. */
  color: string
  balance: number
  /** Current tile index (0–39). */
  position: number
  inJail: boolean
  isBankrupt: boolean
}

/**
 * Phase of the *current* turn — a small state machine that gates which actions
 * are legal. See architecture.md §3.3.
 */
export type TurnPhase =
  | "awaiting-roll" // current player may roll the dice
  | "awaiting-buy" // current player landed on an unowned tile they can afford
  | "awaiting-end" // resolution done, current player must end the turn

export type LogEntry = {
  id: number
  text: string
}

export type GameState = {
  status: "playing" | "finished"
  players: Player[]
  /** Indexed by tile id (0–39), parallel to the board definition. */
  tiles: TileState[]
  currentPlayerIndex: number
  phase: TurnPhase
  dice: [number, number] | null
  /** Consecutive doubles within the current turn (3 → jail). */
  doublesCount: number
  /** Tile id awaiting a buy/decline decision, or null. */
  pendingPurchase: number | null
  /** Seed for the deterministic PRNG; advances on every roll. */
  rngSeed: number
  log: LogEntry[]
  nextLogId: number
  winnerId: string | null
}

/** Intent actions accepted by the reducer. */
export type GameAction =
  | { type: "ROLL_DICE" }
  | { type: "BUY_PROPERTY" }
  | { type: "DECLINE_PROPERTY" }
  | { type: "END_TURN" }
  // Property management — legal on your own turn outside the buy step.
  | { type: "BUILD_HOUSE"; tileId: number }
  | { type: "SELL_HOUSE"; tileId: number }
  | { type: "MORTGAGE"; tileId: number }
  | { type: "UNMORTGAGE"; tileId: number }
