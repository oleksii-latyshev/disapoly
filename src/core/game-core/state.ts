import {
  BANK_SUPPLY,
  boardFor,
  PLAYER_COLORS,
  PLAYER_EMOJIS,
  STARTING_BALANCE,
} from "./constants/board"
import { CHANCE, COMMUNITY_CHEST } from "./constants/cards"
import { createSeed, shuffle } from "./helpers/rng"
import { historyPoint } from "./helpers/selectors"
import type {
  DeckState,
  GameSettings,
  GameState,
  Player,
  TradeOffer,
} from "./types"

export type PlayerSetup = {
  /** Stable id; auto-generated for local hot-seat, supplied for online play. */
  id?: string
  nickname: string
  color?: string
  emoji?: string
}

export const DEFAULT_SETTINGS: GameSettings = {
  payMode: "turbo",
  orderRoll: false,
  board: "classic",
  events: false,
  eventFrequency: "normal",
}

export function createInitialState(
  setups: PlayerSetup[],
  seed: number = createSeed(),
  settings: Partial<GameSettings> = {}
): GameState {
  const rules: GameSettings = { ...DEFAULT_SETTINGS, ...settings }
  const players: Player[] = setups.map((setup, index) => ({
    id: setup.id ?? `p${index + 1}`,
    nickname: setup.nickname.trim() || `Player ${index + 1}`,
    color: setup.color ?? PLAYER_COLORS[index % PLAYER_COLORS.length],
    emoji: setup.emoji ?? PLAYER_EMOJIS[index % PLAYER_EMOJIS.length],
    balance: STARTING_BALANCE,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    isBankrupt: false,
  }))

  const range = (n: number) => Array.from({ length: n }, (_, i) => i)
  const ch = shuffle(range(CHANCE.length), seed)
  const cc = shuffle(range(COMMUNITY_CHEST.length), ch.seed)
  const chance: DeckState = { order: ch.result, pos: 0 }
  const chest: DeckState = { order: cc.result, pos: 0 }

  const board = boardFor(rules.board)
  const state: GameState = {
    status: "playing",
    settings: rules,
    players,
    tiles: board.map(() => ({ ownerId: null, houses: 0, mortgaged: false })),
    currentPlayerIndex: 0,
    phase: rules.orderRoll ? "order-roll" : "awaiting-roll",
    dice: null,
    diceRolls: 0,
    doublesCount: 0,
    pendingPurchase: null,
    auction: null,
    pendingDebt: null,
    orderRolls: rules.orderRoll ? {} : null,
    bank: { ...BANK_SUPPLY[rules.board ?? "classic"] },
    rngSeed: cc.seed,
    chance,
    chest,
    lastCard: null,
    activeEvent: null,
    pendingTrades: [],
    nextTradeId: 1,
    turnCount: 0,
    history: [],
    log: [{ id: 0, key: "log.started", params: { n: players.length } }],
    nextLogId: 1,
    winnerId: null,
  }

  return { ...state, history: [historyPoint(state, 0)] }
}

/** Upgrade a game persisted before the trade queue existed (single `pendingTrade`). */
export function migrateGameState(game: GameState): GameState {
  if (Array.isArray(game.pendingTrades)) return game
  const legacy = game as GameState & { pendingTrade?: TradeOffer | null }
  const pendingTrades = legacy.pendingTrade
    ? [{ ...legacy.pendingTrade, id: 1 }]
    : []
  return { ...game, pendingTrades, nextTradeId: pendingTrades.length + 1 }
}

export * from "./helpers/selectors"
export * from "./helpers/validators"
