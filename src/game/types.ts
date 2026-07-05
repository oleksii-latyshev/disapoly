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
  /** Failed escape attempts during the current jail stint (0–3). */
  jailTurns: number
  /** Held "get out of jail free" cards (Stage 2 part 2 — cards). */
  getOutOfJailCards: number
  isBankrupt: boolean
}

/**
 * Phase of the *current* turn — a small state machine that gates which actions
 * are legal. See architecture.md §3.3.
 */
export type TurnPhase =
  | "awaiting-roll" // current player may roll the dice
  | "awaiting-buy" // current player landed on an unowned tile they can afford
  | "auction" // a declined/unaffordable tile is up for auction among all players
  | "awaiting-pay" // current player owes a debt and must settle it (normal pay mode)
  | "awaiting-end" // resolution done, current player must end the turn

/**
 * How debts are collected. "turbo" (classic behavior) deducts rent/taxes the
 * moment they're incurred; "normal" pauses the turn in `awaiting-pay` so the
 * debtor confirms with PAY_DEBT — giving them a chance to trade/mortgage first.
 */
export type PayMode = "turbo" | "normal"

/** Match rules chosen by the host before the game starts. */
export type GameSettings = { payMode: PayMode }

/** What a pending debt was incurred for (drives the pay prompt copy). */
export type DebtReason = "rent" | "tax" | "card"

/** A charge awaiting confirmation while `phase === "awaiting-pay"`. */
export type PendingDebt = {
  amount: number
  /** Receiving player, or null when the bank collects. */
  creditorId: string | null
  reason: DebtReason
  /** Tile that caused the debt (rent/tax), for display. */
  tileId: number | null
}

/**
 * A live auction for one tile, triggered when the player who landed on it
 * declines (or can't afford) the purchase. Bidding is sequential: `bidderOrder`
 * fixes the rotation and `currentBidderId` points at whoever must act next;
 * each acts by raising above `highBid` or passing (leaving `activeBidderIds`).
 * Ends when only the high bidder remains (they win) or everyone passes (bank
 * keeps the tile).
 */
export type AuctionState = {
  tileId: number
  highBid: number
  highBidderId: string | null
  bidderOrder: string[]
  activeBidderIds: string[]
  currentBidderId: string
}

/** A log param is plain text/number, or `{ t }` for a translatable value. */
export type LogParam = string | number | { t: string }

/** Structured log event: an i18n key plus params the client translates. */
export type LogEntry = {
  id: number
  key: string
  params?: Record<string, LogParam>
}

/** The bank's remaining building stock (classic 32 houses / 12 hotels). */
export type BankSupply = { houses: number; hotels: number }

/** Draw order (card indices) plus a pointer into it; reshuffles on wrap. */
export type DeckState = { order: number[]; pos: number }

/** The most recently drawn card, shown until the turn ends. */
export type DrawnCard = { deck: "chance" | "chest"; cardId: string }

/**
 * A net-worth snapshot for the chart. Has a `turn` key plus one entry per
 * player id → net worth at that point.
 */
export type HistoryPoint = { turn: number } & Record<string, number>

/** One side of a trade: tiles, cash, and jail cards offered. */
export type TradeBundle = { tiles: number[]; money: number; jailCards: number }

/** A pending trade proposal awaiting the partner's response. */
export type TradeOffer = {
  fromId: string
  toId: string
  give: TradeBundle // what `fromId` gives `toId`
  receive: TradeBundle // what `fromId` gets from `toId`
}

export type GameState = {
  status: "playing" | "finished"
  /** Match rules fixed at creation (host-chosen online). */
  settings: GameSettings
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
  /** Live auction for a declined/unaffordable tile, or null. */
  auction: AuctionState | null
  /** Debt awaiting PAY_DEBT confirmation (normal pay mode), or null. */
  pendingDebt: PendingDebt | null
  /** Remaining houses/hotels the bank can still hand out. */
  bank: BankSupply
  /** Seed for the deterministic PRNG; advances on every roll. */
  rngSeed: number
  /** Chance / Community Chest draw piles. */
  chance: DeckState
  chest: DeckState
  /** Card drawn this turn, or null. */
  lastCard: DrawnCard | null
  /** Outstanding trade proposal awaiting a response, or null. */
  pendingTrade: TradeOffer | null
  /** Completed turns so far (x-axis for the net-worth chart). */
  turnCount: number
  /** Net-worth snapshot per completed turn. */
  history: HistoryPoint[]
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
  // Auction — bids are allowed out of turn; the server stamps the bidder's id.
  | { type: "PLACE_BID"; amount: number; playerId: string }
  | { type: "PASS_BID"; playerId: string }
  // Property management — legal on your own turn outside the buy step.
  | { type: "BUILD_HOUSE"; tileId: number }
  | { type: "SELL_HOUSE"; tileId: number }
  | { type: "MORTGAGE"; tileId: number }
  | { type: "UNMORTGAGE"; tileId: number }
  // Jail — only valid for the current player while in jail.
  | { type: "PAY_JAIL_FINE" }
  | { type: "USE_JAIL_CARD" }
  // Trades — allowed out of turn; the server stamps the actor's id.
  | { type: "PROPOSE_TRADE"; offer: TradeOffer }
  | { type: "RESPOND_TRADE"; accept: boolean; playerId: string }
  | { type: "CANCEL_TRADE"; playerId: string }
  // Settle the pending debt (normal pay mode, current player only).
  | { type: "PAY_DEBT" }
  // Voluntary surrender — allowed out of turn; the server stamps the actor's id.
  | { type: "DECLARE_BANKRUPTCY"; playerId: string }
  // Server-only: skip a disconnected player's turn (never sent by clients).
  | { type: "FORCE_END_TURN" }
  // Server-only: bankrupt a long-disconnected player (never sent by clients).
  | { type: "FORCE_BANKRUPT"; playerId: string }
