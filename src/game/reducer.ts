/**
 * Pure rules engine: (state, action) -> state.
 *
 * No I/O, no randomness outside the seeded PRNG, no references to React. Every
 * action is an *intent*; the reducer validates it and applies the result
 * atomically. This is the piece the sync layer will drive in later stages.
 */

import { GO_PAYOUT, JAIL_FINE, moveTargetTile } from "./board.config"
import { reclaimBuildings, returnBuilding, takeBuilding } from "./buildings"
import { CHANCE, COMMUNITY_CHEST, type CardEffect } from "./cards"
import {
  claimEventAt,
  goPayoutMultiplier,
  isRentFrozen,
  maybeSpawnEvent,
  rentMultiplier,
  tickEvent,
} from "./events"
import { log } from "./log"
import { rollDice, shuffle } from "./rng"
import {
  activePlayers,
  boardOf,
  boardSizeOf,
  canBuildHouse,
  canMortgage,
  canSellHouse,
  canUnmortgage,
  currentPlayer,
  historyPoint,
  isTradeValid,
  jailTileId,
  maxRaisable,
  mortgageValue,
  playerById,
  rentFor,
  tileDef,
  unmortgageCost,
} from "./state"
import type {
  AuctionState,
  DebtReason,
  GameAction,
  GameState,
  Player,
  StreetTile,
  TradeOffer,
  TradeProposal,
} from "./types"

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.status !== "playing") return state

  switch (action.type) {
    case "ROLL_DICE":
      if (state.phase === "order-roll") return rollForOrder(clone(state))
      return state.phase === "awaiting-roll" ? roll(clone(state)) : state
    case "BUY_PROPERTY":
      return state.phase === "awaiting-buy" ? buy(clone(state)) : state
    case "DECLINE_PROPERTY":
      return state.phase === "awaiting-buy" ? decline(clone(state)) : state
    case "END_TURN":
      return state.phase === "awaiting-end" ? endTurn(clone(state)) : state
    case "FORCE_END_TURN":
      // Abandon the current player's turn from any phase (disconnect skip).
      // During the opening roll-off there is no turn to end — the absent
      // player's order roll is made for them instead.
      if (state.phase === "order-roll") return rollForOrder(clone(state))
      return endTurn(clone(state))
    case "PLACE_BID":
      return state.phase === "auction"
        ? placeBid(clone(state), action.playerId, action.amount)
        : state
    case "PASS_BID":
      return state.phase === "auction"
        ? passBid(clone(state), action.playerId)
        : state
    case "BUILD_HOUSE":
      return canManage(state) ? buildHouse(clone(state), action.tileId) : state
    case "SELL_HOUSE":
      return canManage(state) ? sellHouse(clone(state), action.tileId) : state
    case "MORTGAGE":
      return canManage(state) ? mortgage(clone(state), action.tileId) : state
    case "UNMORTGAGE":
      return canManage(state) ? unmortgage(clone(state), action.tileId) : state
    case "PAY_JAIL_FINE":
      return canLeaveJail(state) ? payJailFine(clone(state)) : state
    case "USE_JAIL_CARD":
      return canLeaveJail(state) ? redeemJailCard(clone(state)) : state
    case "PROPOSE_TRADE":
      return proposeTrade(clone(state), action.offer)
    case "RESPOND_TRADE":
      return respondTrade(
        clone(state),
        action.tradeId,
        action.accept,
        action.playerId
      )
    case "CANCEL_TRADE":
      return cancelTrade(clone(state), action.tradeId, action.playerId)
    case "PAY_DEBT":
      // The debtor raises the cash themselves (sell/mortgage/trade) — the
      // payment is only accepted once their balance actually covers it.
      return state.phase === "awaiting-pay" &&
        state.pendingDebt !== null &&
        currentPlayer(state).balance >= state.pendingDebt.amount
        ? payDebt(clone(state))
        : state
    case "DECLARE_BANKRUPTCY":
      // Voluntary surrender — allowed from any phase, any (non-bankrupt) player.
      return goBankrupt(state, action.playerId, "log.resigned")
    case "FORCE_BANKRUPT":
      // A long-disconnected player is removed (server alarm; never from clients).
      return goBankrupt(state, action.playerId, "log.removedBankrupt")
    default:
      return state
  }
}

/**
 * Property management is allowed on your own turn, outside the buy step — and
 * while a debt awaits payment, so the debtor can sell/mortgage to raise cash.
 */
function canManage(state: GameState): boolean {
  return (
    state.phase === "awaiting-roll" ||
    state.phase === "awaiting-end" ||
    state.phase === "awaiting-pay"
  )
}

/** Pay/card jail exits are only legal before rolling, while in jail. */
function canLeaveJail(state: GameState): boolean {
  return (
    state.phase === "awaiting-roll" &&
    state.players[state.currentPlayerIndex].inJail
  )
}

// --- action handlers (mutate the cloned draft, then return it) ---

/**
 * Opening roll-off (settings.orderRoll): each player rolls once in join order;
 * the highest roll starts and play proceeds clockwise from them (classic
 * rule). Ties re-roll among the tied — everyone else is marked eliminated
 * with a sentinel -1 so they keep their "already rolled" status but can't win.
 */
function rollForOrder(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]
  const result = rollDice(d.rngSeed)
  d.rngSeed = result.seed
  d.dice = result.dice
  const [a, b] = result.dice
  const sum = a + b
  d.orderRolls = { ...(d.orderRolls ?? {}), [player.id]: sum }
  log(d, "log.orderRolled", { name: player.nickname, a, b, sum })

  // Someone still to roll? Hand them the dice.
  const pending = d.players.filter(
    (p) => !p.isBankrupt && d.orderRolls![p.id] === undefined
  )
  if (pending.length > 0) {
    d.currentPlayerIndex = d.players.findIndex((p) => p.id === pending[0].id)
    return d
  }

  // Everyone rolled: a unique highest roll starts the game...
  const rolls = d.orderRolls!
  const contenders = d.players.filter((p) => !p.isBankrupt)
  const max = Math.max(...contenders.map((p) => rolls[p.id]))
  const top = contenders.filter((p) => rolls[p.id] === max)
  if (top.length === 1) {
    d.currentPlayerIndex = d.players.findIndex((p) => p.id === top[0].id)
    d.orderRolls = null
    d.dice = null
    d.phase = "awaiting-roll"
    log(d, "log.orderFirst", { name: top[0].nickname })
    return d
  }

  // ...otherwise the tied players roll again; the rest are out of the running.
  const next: Record<string, number> = {}
  for (const p of contenders) {
    if (rolls[p.id] !== max) next[p.id] = -1
  }
  d.orderRolls = next
  d.currentPlayerIndex = d.players.findIndex((p) => p.id === top[0].id)
  log(d, "log.orderTie", { n: top.length, sum: max })
  return d
}

function roll(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]
  if (player.inJail) return rollInJail(d, player)

  const result = rollDice(d.rngSeed)
  d.rngSeed = result.seed
  d.dice = result.dice
  const [a, b] = result.dice
  const isDouble = a === b
  const sum = a + b
  log(d, isDouble ? "log.rolledDoubles" : "log.rolled", {
    name: player.nickname,
    a,
    b,
    sum,
  })

  if (isDouble) d.doublesCount += 1
  if (isDouble && d.doublesCount === 3) {
    sendToJail(d, player)
    log(d, "log.threeDoubles", { name: player.nickname })
    d.phase = "awaiting-end"
    return d
  }

  moveBy(d, player, sum)
  resolveLanding(d, sum)
  return settle(d)
}

/**
 * Rolling from jail: doubles free you (and you move that many, but get no extra
 * turn). Otherwise you stay; on the third failed attempt you must pay the fine
 * and then move. See architecture.md §3.8.
 */
function rollInJail(d: GameState, player: Player): GameState {
  const result = rollDice(d.rngSeed)
  d.rngSeed = result.seed
  d.dice = result.dice
  const [a, b] = result.dice
  const isDouble = a === b
  const sum = a + b
  log(d, "log.rolledFromJail", { name: player.nickname, a, b, sum })

  if (isDouble) {
    player.inJail = false
    player.jailTurns = 0
    log(d, "log.jailDoubles", { name: player.nickname })
    moveBy(d, player, sum)
    resolveLanding(d, sum)
    return settleNoExtra(d)
  }

  player.jailTurns += 1
  if (player.jailTurns < 3) {
    log(d, "log.jailStay", { name: player.nickname })
    return settleNoExtra(d)
  }

  // Third failed attempt: pay the fine (may bankrupt), then move.
  log(d, "log.jailThird", { name: player.nickname, fine: JAIL_FINE })
  pay(d, player, JAIL_FINE, null)
  player.inJail = false
  player.jailTurns = 0
  if (!player.isBankrupt) {
    moveBy(d, player, sum)
    resolveLanding(d, sum)
  }
  return settleNoExtra(d)
}

function payJailFine(d: GameState): GameState {
  const player = currentPlayer(d)
  pay(d, player, JAIL_FINE, null)
  if (player.isBankrupt) return settleNoExtra(d)
  player.inJail = false
  player.jailTurns = 0
  log(d, "log.jailPaid", { name: player.nickname, fine: JAIL_FINE })
  return d // stays in awaiting-roll so the player then rolls to move
}

function redeemJailCard(d: GameState): GameState {
  const player = currentPlayer(d)
  if (player.getOutOfJailCards <= 0) return d
  player.getOutOfJailCards -= 1
  player.inJail = false
  player.jailTurns = 0
  log(d, "log.jailCard", { name: player.nickname })
  return d // stays in awaiting-roll
}

// --- trading (Stage 3) ---

/** Drop every pending trade `playerId` is a party to (they left / can't answer). */
function dropTradesWith(d: GameState, playerId: string): void {
  d.pendingTrades = d.pendingTrades.filter(
    (t) => t.fromId !== playerId && t.toId !== playerId
  )
}

function proposeTrade(d: GameState, offer: TradeProposal): GameState {
  if (!isTradeValid(d, offer)) return d
  // Several trades may be pending at once, but only one per from→to pair —
  // withdraw (or wait out) the previous offer before re-offering.
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

function respondTrade(
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
  // Re-validate at apply time: an earlier accepted trade (or a purchase) may
  // have invalidated a queued offer since it was proposed.
  if (!isTradeValid(d, offer)) {
    log(d, "log.tradeInvalid")
    return d
  }
  applyTrade(d, offer)
  log(d, "log.tradeAccepted", { name: to?.nickname ?? "?" })
  return d
}

function cancelTrade(
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

/** Atomically swap the two bundles between the players. */
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

/** Advance a player by `steps`, paying the GO bonus when passing it. */
function moveBy(d: GameState, player: Player, steps: number): void {
  const from = player.position
  const to = (from + steps) % boardSizeOf(d)
  if (to < from) {
    // Golden dice (surprise event) double the GO salary while they last.
    const payout = GO_PAYOUT * goPayoutMultiplier(d)
    player.balance += payout
    log(d, "log.passGo", { name: player.nickname, amount: payout })
  }
  player.position = to
}

function resolveLanding(d: GameState, diceSum: number): void {
  const player = d.players[d.currentPlayerIndex]
  const def = tileDef(d, player.position)

  // A surprise event waiting on this tile pays out first — its prize can help
  // cover whatever the tile itself charges.
  claimEventAt(d, player)

  switch (def.type) {
    case "tax":
      log(d, "log.tax", {
        name: player.nickname,
        tile: def.name,
        amount: def.amount,
      })
      charge(d, player, def.amount, null, "tax", def.id)
      return

    case "goToJail":
      sendToJail(d, player)
      log(d, "log.toJail", { name: player.nickname })
      return

    case "street":
    case "railroad":
    case "utility": {
      const tile = d.tiles[def.id]
      if (tile.ownerId === null) {
        if (player.balance >= def.price) {
          d.pendingPurchase = def.id
          d.phase = "awaiting-buy"
        } else {
          log(d, "log.cantAfford", {
            name: player.nickname,
            tile: def.name,
            price: def.price,
          })
          openAuction(d, def.id)
        }
      } else if (tile.ownerId !== player.id) {
        // A rent-freeze event suspends all rent while it lasts.
        if (isRentFrozen(d)) {
          log(d, "log.rentFrozen", { name: player.nickname, tile: def.name })
          return
        }
        // A rent surge ("boom day") doubles every rent while it lasts.
        const rent = rentFor(d, def.id, diceSum) * rentMultiplier(d)
        const owner = d.players.find((p) => p.id === tile.ownerId)!
        log(d, "log.rent", {
          name: player.nickname,
          rent,
          owner: owner.nickname,
          tile: def.name,
        })
        charge(d, player, rent, owner.id, "rent", def.id)
      }
      return
    }

    case "chance":
      drawCard(d, "chance", diceSum)
      return

    case "communityChest":
      drawCard(d, "chest", diceSum)
      return

    default:
      // go, jail (just visiting), freeParking: no effect.
      return
  }
}

/** Draw the top card of a deck (reshuffling on wrap) and apply its effect. */
function drawCard(
  d: GameState,
  deck: "chance" | "chest",
  diceSum: number
): void {
  const cards = deck === "chance" ? CHANCE : COMMUNITY_CHEST
  const pile = d[deck]
  if (pile.pos >= pile.order.length) {
    const reshuffled = shuffle(pile.order, d.rngSeed)
    d.rngSeed = reshuffled.seed
    pile.order = reshuffled.result
    pile.pos = 0
  }
  const card = cards[pile.order[pile.pos]]
  pile.pos += 1
  d.lastCard = { deck, cardId: card.id }
  log(d, "log.drew", {
    name: currentPlayer(d).nickname,
    card: { t: `card.${card.id}` },
  })
  applyCard(d, card.effect, diceSum)
}

function applyCard(d: GameState, effect: CardEffect, diceSum: number): void {
  const player = currentPlayer(d)
  const others = d.players.filter((p) => !p.isBankrupt && p.id !== player.id)

  switch (effect.kind) {
    case "money":
      if (effect.amount >= 0) player.balance += effect.amount
      else charge(d, player, -effect.amount, null, "card", null)
      return
    case "collectFromEach":
      for (const other of others) pay(d, other, effect.amount, player.id)
      return
    case "payEach":
      for (const other of others) pay(d, player, effect.amount, other.id)
      return
    case "repairs": {
      let houses = 0
      let hotels = 0
      for (const def of boardOf(d)) {
        if (def.type === "street" && d.tiles[def.id].ownerId === player.id) {
          if (d.tiles[def.id].houses === 5) hotels += 1
          else houses += d.tiles[def.id].houses
        }
      }
      charge(
        d,
        player,
        houses * effect.perHouse + hotels * effect.perHotel,
        null,
        "card",
        null
      )
      return
    }
    case "moveTo": {
      const size = boardSizeOf(d)
      const tile = moveTargetTile(boardOf(d), effect.target)
      moveBy(d, player, (tile - player.position + size) % size)
      resolveLanding(d, diceSum)
      return
    }
    case "moveBack": {
      const size = boardSizeOf(d)
      player.position = (player.position - effect.steps + size) % size
      resolveLanding(d, diceSum)
      return
    }
    case "goToJail":
      sendToJail(d, player)
      log(d, "log.toJail", { name: player.nickname })
      return
    case "getOutOfJail":
      player.getOutOfJailCards += 1
      return
  }
}

function buy(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]
  const tileId = d.pendingPurchase!
  const def = tileDef(d, tileId)
  const price = "price" in def ? def.price : 0

  if (player.balance >= price) {
    player.balance -= price
    d.tiles[tileId].ownerId = player.id
    log(d, "log.bought", { name: player.nickname, tile: def.name, price })
  }
  d.pendingPurchase = null
  d.phase = "awaiting-end" // clear the buy gate so settle() can recompute
  return settle(d)
}

function decline(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]
  const tileId = d.pendingPurchase!
  log(d, "log.declinedBuy", {
    name: player.nickname,
    tile: tileDef(d, tileId).name,
  })
  d.pendingPurchase = null
  // A declined tile goes to auction among all players (classic rule).
  return openAuction(d, tileId)
}

// --- auction (declined-purchase rule) ---

/**
 * Open an auction for `tileId`. Bidding rotates through the active (non-bankrupt)
 * players starting from the one who landed on the tile.
 */
function openAuction(d: GameState, tileId: number): GameState {
  const order = activePlayers(d).map((p) => p.id)
  if (order.length === 0) {
    d.phase = "awaiting-end"
    return d
  }
  // Rotate the order so bidding starts with the current player.
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

/** The next still-active bidder after `fromId` in the fixed rotation, if any. */
function nextActiveBidder(a: AuctionState, fromId: string): string | null {
  const order = a.bidderOrder
  const start = order.indexOf(fromId)
  for (let i = 1; i <= order.length; i++) {
    const id = order[(start + i) % order.length]
    if (a.activeBidderIds.includes(id)) return id
  }
  return null
}

function placeBid(d: GameState, playerId: string, amount: number): GameState {
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

function passBid(d: GameState, playerId: string): GameState {
  const a = d.auction
  if (!a || playerId !== a.currentBidderId) return d
  if (playerId === a.highBidderId) return d // the leader can't fold their own bid
  if (!a.activeBidderIds.includes(playerId)) return d
  const bidder = playerById(d, playerId)
  log(d, "log.auctionPass", { name: bidder?.nickname ?? "?" })
  a.activeBidderIds = a.activeBidderIds.filter((id) => id !== playerId)
  const next = nextActiveBidder(a, playerId)
  if (next) a.currentBidderId = next
  return resolveAuctionIfDone(d)
}

/**
 * Close the auction if it's decided: the high bidder wins once they're the only
 * one left in, or the tile stays with the bank if everyone passed without a bid.
 * Then hand back to the normal turn `settle`.
 */
function resolveAuctionIfDone(d: GameState): GameState {
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
  d.phase = "awaiting-end" // clear the auction gate so settle() can recompute
  return settle(d)
}

function endTurn(d: GameState): GameState {
  // A force-ended turn can still owe a confirmed debt — collect it instantly
  // so skipping a disconnected player never dodges rent.
  if (d.pendingDebt) {
    const debt = d.pendingDebt
    d.pendingDebt = null
    pay(d, d.players[d.currentPlayerIndex], debt.amount, debt.creditorId)
  }

  d.doublesCount = 0
  d.pendingPurchase = null
  d.lastCard = null
  d.auction = null

  const count = d.players.length
  let next = d.currentPlayerIndex
  for (let i = 0; i < count; i++) {
    next = (next + 1) % count
    if (!d.players[next].isBankrupt) break
  }
  d.currentPlayerIndex = next
  d.phase = "awaiting-roll"
  d.turnCount += 1
  // Surprise events: expire / hop the live one, then maybe spawn a fresh one.
  tickEvent(d)
  maybeSpawnEvent(d)
  d.history = [...d.history, historyPoint(d, d.turnCount)]
  return d
}

// --- property management (Stage 2) ---

function buildHouse(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canBuildHouse(d, player.id, tileId)) return d
  const def = tileDef(d, tileId) as StreetTile
  player.balance -= def.houseCost
  takeBuilding(d, tileId)
  log(d, d.tiles[tileId].houses === 5 ? "log.builtHotel" : "log.builtHouse", {
    name: player.nickname,
    tile: def.name,
    cost: def.houseCost,
  })
  return d
}

function sellHouse(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canSellHouse(d, player.id, tileId)) return d
  const def = tileDef(d, tileId) as StreetTile
  const refund = Math.floor(def.houseCost / 2)
  returnBuilding(d, tileId)
  player.balance += refund
  log(d, "log.soldBuilding", { name: player.nickname, tile: def.name, refund })
  return d
}

function mortgage(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canMortgage(d, player.id, tileId)) return d
  const value = mortgageValue(d, tileId)
  d.tiles[tileId].mortgaged = true
  player.balance += value
  log(d, "log.mortgaged", {
    name: player.nickname,
    tile: tileDef(d, tileId).name,
    value,
  })
  return d
}

function unmortgage(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canUnmortgage(d, player.id, tileId)) return d
  const cost = unmortgageCost(d, tileId)
  d.tiles[tileId].mortgaged = false
  player.balance -= cost
  log(d, "log.unmortgaged", {
    name: player.nickname,
    tile: tileDef(d, tileId).name,
    cost,
  })
  return d
}

// --- helpers ---

/**
 * Decide the phase after a landing/purchase is resolved: an unresolved purchase
 * keeps us in "awaiting-buy"; rolling doubles grants another roll; otherwise the
 * turn awaits its end.
 */
function settle(d: GameState): GameState {
  if (d.status !== "playing") return d
  if (
    d.phase === "awaiting-buy" ||
    d.phase === "auction" ||
    d.phase === "awaiting-pay"
  )
    return d

  const player = d.players[d.currentPlayerIndex]
  const isDouble = !!d.dice && d.dice[0] === d.dice[1]
  d.phase =
    isDouble && !player.inJail && !player.isBankrupt
      ? "awaiting-roll"
      : "awaiting-end"
  return d
}

/** Like `settle`, but never grants an extra roll (a jail-exit roll doesn't). */
function settleNoExtra(d: GameState): GameState {
  if (d.status !== "playing") return d
  if (
    d.phase !== "awaiting-buy" &&
    d.phase !== "auction" &&
    d.phase !== "awaiting-pay"
  ) {
    d.phase = "awaiting-end"
  }
  return d
}

/**
 * Charge the debtor, honoring the match's pay mode: in "normal" mode a debt of
 * the current player pauses the turn in `awaiting-pay` until they confirm with
 * PAY_DEBT — and *they* choose what to sell or mortgage to cover it. A debt
 * beyond their maximum raisable value skips the pause (there is no choice to
 * make) and liquidates/bankrupts instantly, like "turbo" mode — which also
 * handles charges hitting someone who isn't the acting player.
 * (`settings` is optional-chained so matches persisted before the setting
 * existed keep working after a deploy.)
 */
function charge(
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

/** Settle the confirmed debt (may auto-liquidate/bankrupt, like any payment). */
function payDebt(d: GameState): GameState {
  const debt = d.pendingDebt
  if (!debt) return d
  d.pendingDebt = null
  pay(d, currentPlayer(d), debt.amount, debt.creditorId)
  d.phase = "awaiting-end" // clear the pay gate so settle() can recompute
  return settle(d)
}

/**
 * Remove a player from the match outside the normal insolvency path (voluntary
 * surrender or a force-removed long-disconnected player). Any confirmed pending
 * debt is collected first (so the creditor isn't stiffed — this alone may
 * bankrupt them to that creditor, classic rules). Otherwise their properties
 * return to the bank *unowned* and clear, up for grabs again.
 */
function goBankrupt(
  state: GameState,
  playerId: string,
  logKey: string
): GameState {
  const target = playerById(state, playerId)
  if (!target || target.isBankrupt || state.status !== "playing") return state

  const d = clone(state)
  const player = playerById(d, playerId)!

  if (d.pendingDebt && d.players[d.currentPlayerIndex].id === playerId) {
    const debt = d.pendingDebt
    d.pendingDebt = null
    pay(d, player, debt.amount, debt.creditorId)
  }

  if (!player.isBankrupt) {
    player.isBankrupt = true
    player.balance = 0
    player.inJail = false
    player.jailTurns = 0
    player.getOutOfJailCards = 0
    for (let id = 0; id < d.tiles.length; id++) {
      const tile = d.tiles[id]
      if (tile.ownerId === playerId) {
        reclaimBuildings(d, id)
        tile.ownerId = null
        tile.mortgaged = false
      }
    }
    log(d, logKey, { name: player.nickname })
    checkGameOver(d)
  }

  // The departed player can't answer trades or bid in an auction.
  dropTradesWith(d, playerId)
  dropFromAuction(d, playerId)

  // If it was their turn (and no auction is still running), pass it on.
  if (
    d.status === "playing" &&
    d.phase !== "auction" &&
    d.players[d.currentPlayerIndex].id === playerId
  ) {
    return endTurn(d)
  }
  return d
}

/**
 * Drop a departing player from a live auction. Their high bid (if any) is void
 * — bidding reopens from zero for whoever remains — and the auction resolves
 * if their exit decides it.
 */
function dropFromAuction(d: GameState, playerId: string): void {
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

/**
 * Move `amount` from `debtor` to `creditorId` (or the bank when null). If the
 * debtor is short, they auto-liquidate (sell buildings, then mortgage) to try to
 * cover it; if assets still fall short, they go bankrupt and hand everything to
 * the creditor (or back to the bank). Liquidation is automatic — no interactive
 * "raise money" step (see architecture.md §3.10).
 */
function pay(
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

  // Still insolvent after liquidation: hand over remaining cash and properties.
  if (creditor) creditor.balance += debtor.balance
  debtor.balance = 0
  debtor.isBankrupt = true
  // Drop any pending trades that involve the now-bankrupt player.
  dropTradesWith(d, debtor.id)
  for (let id = 0; id < d.tiles.length; id++) {
    const tile = d.tiles[id]
    if (tile.ownerId === debtor.id) {
      // Buildings can't be transferred — they go back to the bank's stock.
      reclaimBuildings(d, id)
      tile.ownerId = creditorId
      // A creditor inherits the mortgage; assets returned to the bank are clear.
      if (!creditorId) tile.mortgaged = false
    }
  }
  log(d, "log.bankrupt", { name: debtor.nickname })
  checkGameOver(d)
}

/**
 * Raise cash for an insolvent debtor up to `target`: sell buildings (half cost),
 * then mortgage clear properties (half price). Stops early once covered.
 */
function raiseCash(d: GameState, debtor: Player, target: number): void {
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

function sendToJail(d: GameState, player: Player): void {
  player.position = jailTileId(d)
  player.inJail = true
  player.jailTurns = 0
}

function checkGameOver(d: GameState): void {
  const remaining = activePlayers(d)
  if (remaining.length <= 1) {
    d.status = "finished"
    d.winnerId = remaining[0]?.id ?? null
    if (remaining[0]) log(d, "log.wins", { name: remaining[0].nickname })
    else log(d, "log.gameOver")
  }
}

/** Shallow-clone the parts of state that handlers mutate. */
function clone(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    tiles: state.tiles.map((t) => ({ ...t })),
    chance: { order: [...state.chance.order], pos: state.chance.pos },
    chest: { order: [...state.chest.order], pos: state.chest.pos },
    bank: { ...state.bank },
    auction: state.auction
      ? {
          ...state.auction,
          bidderOrder: [...state.auction.bidderOrder],
          activeBidderIds: [...state.auction.activeBidderIds],
        }
      : null,
    pendingTrades: [...state.pendingTrades],
    log: [...state.log],
  }
}
