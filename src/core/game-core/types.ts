export type ColorGroup =
  | "brown"
  | "teal"
  | "lightBlue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "violet"
  | "green"
  | "darkBlue"

export type BoardId = "classic" | "large"

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

export type OwnableType = "street" | "railroad" | "utility"

export type TileState = {
  /** playerId of the owner, or null if owned by the bank. */
  ownerId: string | null
  /** Houses built (0–4); 5 represents a hotel. Streets only. */
  houses: number
  mortgaged: boolean
}

export type Player = {
  id: string
  nickname: string
  color: string
  emoji: string
  balance: number
  position: number
  inJail: boolean
  /** Failed escape attempts during the current jail stint (0–3). */
  jailTurns: number
  getOutOfJailCards: number
  isBankrupt: boolean
}

export type TurnPhase =
  | "order-roll"
  | "awaiting-roll"
  | "awaiting-buy"
  | "auction"
  | "awaiting-pay"
  | "awaiting-end"

/** "turbo" deducts charges instantly; "normal" pauses in `awaiting-pay` for PAY_DEBT. */
export type PayMode = "turbo" | "normal"

/**
 * Match rules fixed at creation. Fields added after launch are optional so
 * matches persisted by older builds keep working after a deploy.
 */
export type GameSettings = {
  payMode: PayMode
  orderRoll: boolean
  board?: BoardId
  events?: boolean
  /** Event kinds allowed to spawn. Unset = all; empty = none. */
  eventKinds?: BoardEventKind[]
  eventFrequency?: EventFrequency
}

export type EventFrequency = "rare" | "normal" | "frequent"

export type BoardEventKind =
  | "bounty"
  | "rabbit"
  | "goldenDice"
  | "rentFreeze"
  | "rentSurge"
  | "earthquake"
  | "windfall"
  | "jailbreak"
  | "taxAudit"

export type BoardEvent = {
  kind: BoardEventKind
  /** Tile the event sits on (bounty/rabbit), or null for global modifiers. */
  tileId: number | null
  /** Prize paid on claim; 0 for global modifiers. */
  amount: number
  expiresAtTurn: number
}

export type DebtReason = "rent" | "tax" | "card"

export type PendingDebt = {
  amount: number
  /** Receiving player, or null when the bank collects. */
  creditorId: string | null
  reason: DebtReason
  /** Tile that caused the debt (rent/tax), for display. */
  tileId: number | null
}

/**
 * Sequential auction for one declined/unaffordable tile: `bidderOrder` fixes
 * the rotation, `currentBidderId` must raise above `highBid` or pass out of
 * `activeBidderIds`. Ends when only the high bidder remains, or everyone
 * passed without a bid (bank keeps the tile).
 */
export type AuctionState = {
  tileId: number
  highBid: number
  highBidderId: string | null
  bidderOrder: string[]
  activeBidderIds: string[]
  currentBidderId: string
}

/** Plain text/number, or `{ t }` for a value the client translates. */
export type LogParam = string | number | { t: string }

export type LogEntry = {
  id: number
  key: string
  params?: Record<string, LogParam>
}

export type BankSupply = { houses: number; hotels: number }

/** Draw order (card indices) plus a pointer into it; reshuffles on wrap. */
export type DeckState = { order: number[]; pos: number }

export type DrawnCard = { deck: "chance" | "chest"; cardId: string }

/** `turn` plus one entry per player id → net worth at that point. */
export type HistoryPoint = { turn: number } & Record<string, number>

export type TradeBundle = { tiles: number[]; money: number; jailCards: number }

export type TradeOffer = {
  /** Unique within the match, assigned by the reducer on propose. */
  id: number
  fromId: string
  toId: string
  give: TradeBundle
  receive: TradeBundle
}

export type TradeProposal = Omit<TradeOffer, "id">

export type GameState = {
  status: "playing" | "finished"
  settings: GameSettings
  players: Player[]
  /** Indexed by tile id, parallel to the board definition. */
  tiles: TileState[]
  currentPlayerIndex: number
  phase: TurnPhase
  dice: [number, number] | null
  /**
   * Monotonic count of dice rolls — bumped only when the dice are actually
   * thrown, so the UI re-tumbles them on a real roll (even on a repeat value)
   * and never on other `rngSeed` changes (cards, events). Optional: unset in
   * matches persisted before it existed.
   */
  diceRolls?: number
  /** Consecutive doubles within the current turn (3 → jail). */
  doublesCount: number
  pendingPurchase: number | null
  auction: AuctionState | null
  pendingDebt: PendingDebt | null
  /**
   * Roll-off results (dice sum per playerId) while `phase` is "order-roll";
   * -1 marks a player eliminated from a tie re-roll. Null once decided.
   */
  orderRolls: Record<string, number> | null
  bank: BankSupply
  /** Seed for the deterministic PRNG; advances on every draw. */
  rngSeed: number
  chance: DeckState
  chest: DeckState
  lastCard: DrawnCard | null
  /** Optional: unset in matches persisted before events existed. */
  activeEvent?: BoardEvent | null
  /** No event spawns before `turnCount` reaches this value. */
  eventCooldownUntil?: number
  /** Open offers — at most one per from→to pair, re-validated at apply time. */
  pendingTrades: TradeOffer[]
  nextTradeId: number
  turnCount: number
  /** Net-worth snapshot per completed turn (stats chart). */
  history: HistoryPoint[]
  log: LogEntry[]
  nextLogId: number
  winnerId: string | null
}

export type GameAction =
  | { type: "ROLL_DICE" }
  | { type: "BUY_PROPERTY" }
  | { type: "DECLINE_PROPERTY" }
  | { type: "END_TURN" }
  // Out-of-turn actions carry a playerId that the server stamps (spoof-proof).
  | { type: "PLACE_BID"; amount: number; playerId: string }
  | { type: "PASS_BID"; playerId: string }
  | { type: "BUILD_HOUSE"; tileId: number }
  | { type: "SELL_HOUSE"; tileId: number }
  | { type: "MORTGAGE"; tileId: number }
  | { type: "UNMORTGAGE"; tileId: number }
  | { type: "PAY_JAIL_FINE" }
  | { type: "USE_JAIL_CARD" }
  | { type: "PROPOSE_TRADE"; offer: TradeProposal }
  | {
      type: "RESPOND_TRADE"
      tradeId: number
      accept: boolean
      playerId: string
    }
  | { type: "CANCEL_TRADE"; tradeId: number; playerId: string }
  | { type: "PAY_DEBT" }
  | { type: "DECLARE_BANKRUPTCY"; playerId: string }
  // Server-only; never accepted from clients.
  | { type: "FORCE_END_TURN" }
  | { type: "FORCE_BANKRUPT"; playerId: string }
