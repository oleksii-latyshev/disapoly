import { log } from "../helpers/log"
import { activePlayers, playerById, tileDef } from "../helpers/selectors"
import type { AuctionState, GameState } from "../types"
import { settle } from "./phase"

/** Bidding rotates through active players, starting from whoever landed. */
export function openAuction(d: GameState, tileId: number): GameState {
  const order = activePlayers(d).map((p) => p.id)
  if (order.length === 0) {
    d.phase = "awaiting-end"
    return d
  }
  const start = Math.max(0, order.indexOf(d.players[d.currentPlayerIndex].id))
  const rotated = [...order.slice(start), ...order.slice(0, start)]
  d.auction = {
    tileId,
    highBid: 0,
    highBidderId: null,
    bidderOrder: rotated,
    activeBidderIds: [...rotated],
    currentBidderId: rotated[0],
  }
  d.phase = "auction"
  log(d, "log.auctionStart", { tile: tileDef(d, tileId).name })
  return d
}

export function nextActiveBidder(
  a: AuctionState,
  fromId: string
): string | null {
  const order = a.bidderOrder
  const start = order.indexOf(fromId)
  for (let i = 1; i <= order.length; i++) {
    const id = order[(start + i) % order.length]
    if (a.activeBidderIds.includes(id)) return id
  }
  return null
}

export function placeBid(
  d: GameState,
  playerId: string,
  amount: number
): GameState {
  const a = d.auction
  if (!a || playerId !== a.currentBidderId) return d
  if (!a.activeBidderIds.includes(playerId)) return d
  const bidder = playerById(d, playerId)
  if (!bidder) return d
  if (
    !Number.isInteger(amount) ||
    amount <= a.highBid ||
    amount > bidder.balance
  ) {
    return d
  }
  a.highBid = amount
  a.highBidderId = playerId
  log(d, "log.bid", {
    name: bidder.nickname,
    amount,
    tile: tileDef(d, a.tileId).name,
  })
  const next = nextActiveBidder(a, playerId)
  if (next) a.currentBidderId = next
  return resolveAuctionIfDone(d)
}

export function passBid(d: GameState, playerId: string): GameState {
  const a = d.auction
  if (!a || playerId !== a.currentBidderId) return d
  if (playerId === a.highBidderId) return d
  if (!a.activeBidderIds.includes(playerId)) return d
  const bidder = playerById(d, playerId)
  log(d, "log.auctionPass", { name: bidder?.nickname ?? "?" })
  a.activeBidderIds = a.activeBidderIds.filter((id) => id !== playerId)
  const next = nextActiveBidder(a, playerId)
  if (next) a.currentBidderId = next
  return resolveAuctionIfDone(d)
}

/** The high bidder wins once alone; no bids at all leaves it with the bank. */
export function resolveAuctionIfDone(d: GameState): GameState {
  const a = d.auction!
  const decided =
    (a.highBidderId !== null && a.activeBidderIds.length <= 1) ||
    a.activeBidderIds.length === 0
  if (!decided) return d

  if (a.highBidderId !== null && a.highBid > 0) {
    const winner = playerById(d, a.highBidderId)!
    winner.balance -= a.highBid
    d.tiles[a.tileId].ownerId = winner.id
    log(d, "log.auctionWon", {
      name: winner.nickname,
      tile: tileDef(d, a.tileId).name,
      price: a.highBid,
    })
  } else {
    log(d, "log.auctionNoBids", { tile: tileDef(d, a.tileId).name })
  }
  d.auction = null
  d.phase = "awaiting-end"
  return settle(d)
}

/** A departing player's high bid is void — bidding reopens from zero. */
export function dropFromAuction(d: GameState, playerId: string): void {
  const a = d.auction
  if (!a) return
  if (!a.activeBidderIds.includes(playerId) && a.highBidderId !== playerId)
    return
  if (a.highBidderId === playerId) {
    a.highBidderId = null
    a.highBid = 0
  }
  if (a.currentBidderId === playerId) {
    const next = nextActiveBidder(a, playerId)
    if (next && next !== playerId) a.currentBidderId = next
  }
  a.activeBidderIds = a.activeBidderIds.filter((id) => id !== playerId)
  resolveAuctionIfDone(d)
}
