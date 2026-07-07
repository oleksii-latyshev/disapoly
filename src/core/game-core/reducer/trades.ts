import { log } from "../helpers/log"
import { isTradeValid } from "../helpers/validators"
import type { GameState, TradeOffer, TradeProposal } from "../types"

/** Drop every pending trade `playerId` is a party to (they left the game). */
export function dropTradesWith(d: GameState, playerId: string): void {
  d.pendingTrades = d.pendingTrades.filter(
    (t) => t.fromId !== playerId && t.toId !== playerId
  )
}

export function proposeTrade(d: GameState, offer: TradeProposal): GameState {
  if (!isTradeValid(d, offer)) return d
  const duplicate = d.pendingTrades.some(
    (t) => t.fromId === offer.fromId && t.toId === offer.toId
  )
  if (duplicate) return d
  d.pendingTrades = [...d.pendingTrades, { ...offer, id: d.nextTradeId }]
  d.nextTradeId += 1
  const from = d.players.find((p) => p.id === offer.fromId)
  const to = d.players.find((p) => p.id === offer.toId)
  log(d, "log.tradeProposed", {
    from: from?.nickname ?? "?",
    to: to?.nickname ?? "?",
  })
  return d
}

export function respondTrade(
  d: GameState,
  tradeId: number,
  accept: boolean,
  playerId: string
): GameState {
  const offer = d.pendingTrades.find((t) => t.id === tradeId)
  if (!offer || offer.toId !== playerId) return d
  const to = d.players.find((p) => p.id === offer.toId)
  d.pendingTrades = d.pendingTrades.filter((t) => t.id !== tradeId)

  if (!accept) {
    log(d, "log.tradeDeclined", { name: to?.nickname ?? "?" })
    return d
  }
  // An earlier accepted trade (or a purchase) may have invalidated this offer.
  if (!isTradeValid(d, offer)) {
    log(d, "log.tradeInvalid")
    return d
  }
  applyTrade(d, offer)
  log(d, "log.tradeAccepted", { name: to?.nickname ?? "?" })
  return d
}

export function cancelTrade(
  d: GameState,
  tradeId: number,
  playerId: string
): GameState {
  const offer = d.pendingTrades.find((t) => t.id === tradeId)
  if (!offer || offer.fromId !== playerId) return d
  d.pendingTrades = d.pendingTrades.filter((t) => t.id !== tradeId)
  log(d, "log.tradeWithdrawn")
  return d
}

function applyTrade(d: GameState, offer: TradeOffer): void {
  const from = d.players.find((p) => p.id === offer.fromId)!
  const to = d.players.find((p) => p.id === offer.toId)!

  for (const id of offer.give.tiles) d.tiles[id].ownerId = to.id
  for (const id of offer.receive.tiles) d.tiles[id].ownerId = from.id

  from.balance += offer.receive.money - offer.give.money
  to.balance += offer.give.money - offer.receive.money
  from.getOutOfJailCards += offer.receive.jailCards - offer.give.jailCards
  to.getOutOfJailCards += offer.give.jailCards - offer.receive.jailCards
}
