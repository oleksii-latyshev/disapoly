import { reclaimBuildings, returnBuilding } from "../helpers/buildings"
import { log } from "../helpers/log"
import {
  activePlayers,
  boardOf,
  currentPlayer,
  maxRaisable,
} from "../helpers/selectors"
import type { DebtReason, GameState, Player } from "../types"
import { settle } from "./phase"
import { dropTradesWith } from "./trades"

/**
 * Charge the debtor, honoring the match's pay mode. In "normal" mode a payable
 * debt of the acting player pauses the turn in `awaiting-pay` until PAY_DEBT —
 * they choose what to sell or mortgage. A debt beyond `maxRaisable` offers no
 * choice, so it liquidates/bankrupts instantly, like "turbo" mode does.
 */
export function charge(
  d: GameState,
  debtor: Player,
  amount: number,
  creditorId: string | null,
  reason: DebtReason,
  tileId: number | null
): void {
  if (
    d.settings?.payMode === "normal" &&
    amount > 0 &&
    debtor.id === d.players[d.currentPlayerIndex].id &&
    amount <= maxRaisable(d, debtor.id)
  ) {
    d.pendingDebt = { amount, creditorId, reason, tileId }
    d.phase = "awaiting-pay"
    return
  }
  pay(d, debtor, amount, creditorId)
}

export function payDebt(d: GameState): GameState {
  const debt = d.pendingDebt
  if (!debt) return d
  d.pendingDebt = null
  pay(d, currentPlayer(d), debt.amount, debt.creditorId)
  d.phase = "awaiting-end"
  return settle(d)
}

/**
 * Move `amount` from `debtor` to `creditorId` (the bank when null). A short
 * debtor auto-liquidates (sell buildings, then mortgage); if assets still fall
 * short they go bankrupt and hand everything to the creditor or the bank.
 */
export function pay(
  d: GameState,
  debtor: Player,
  amount: number,
  creditorId: string | null
): void {
  const creditor = creditorId
    ? (d.players.find((p) => p.id === creditorId) ?? null)
    : null

  if (debtor.balance < amount) raiseCash(d, debtor, amount)

  if (debtor.balance >= amount) {
    debtor.balance -= amount
    if (creditor) creditor.balance += amount
    return
  }

  if (creditor) creditor.balance += debtor.balance
  debtor.balance = 0
  debtor.isBankrupt = true
  dropTradesWith(d, debtor.id)
  for (let id = 0; id < d.tiles.length; id++) {
    const tile = d.tiles[id]
    if (tile.ownerId === debtor.id) {
      // Buildings can't change hands — they return to the bank's stock.
      reclaimBuildings(d, id)
      tile.ownerId = creditorId
      // A creditor inherits the mortgage; assets returned to the bank are clear.
      if (!creditorId) tile.mortgaged = false
    }
  }
  log(d, "log.bankrupt", { name: debtor.nickname })
  checkGameOver(d)
}

/** Sell buildings (half cost), then mortgage clear properties, until covered. */
export function raiseCash(d: GameState, debtor: Player, target: number): void {
  for (const def of boardOf(d)) {
    if (debtor.balance >= target) return
    if (def.type !== "street") continue
    const tile = d.tiles[def.id]
    if (tile.ownerId !== debtor.id) continue
    while (tile.houses > 0 && debtor.balance < target) {
      returnBuilding(d, def.id)
      debtor.balance += Math.floor(def.houseCost / 2)
    }
  }
  for (const def of boardOf(d)) {
    if (debtor.balance >= target) return
    if (!("price" in def)) continue
    const tile = d.tiles[def.id]
    if (tile.ownerId !== debtor.id || tile.mortgaged) continue
    tile.mortgaged = true
    debtor.balance += Math.floor(def.price / 2)
  }
}

export function checkGameOver(d: GameState): void {
  const remaining = activePlayers(d)
  if (remaining.length <= 1) {
    d.status = "finished"
    d.winnerId = remaining[0]?.id ?? null
    if (remaining[0]) log(d, "log.wins", { name: remaining[0].nickname })
    else log(d, "log.gameOver")
  }
}
