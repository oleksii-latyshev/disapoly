import { JAIL_FINE } from "../constants/board"
import { maybeSpawnEvent, tickEvent } from "../helpers/events"
import { log } from "../helpers/log"
import { rollDice } from "../helpers/rng"
import { currentPlayer, historyPoint, tileDef } from "../helpers/selectors"
import type { GameState, Player } from "../types"
import { openAuction } from "./auction"
import { pay } from "./payments"
import { settle, settleNoExtra } from "./phase"
import { moveBy, resolveLanding, sendToJail } from "./movement"

function rollFor(d: GameState): { a: number; b: number } {
  const result = rollDice(d.rngSeed)
  d.rngSeed = result.seed
  d.dice = result.dice
  d.diceRolls = (d.diceRolls ?? 0) + 1
  return { a: result.dice[0], b: result.dice[1] }
}

/**
 * Opening roll-off (settings.orderRoll): each player rolls once; the highest
 * starts and play proceeds clockwise. Ties re-roll among the tied — everyone
 * else is marked with a sentinel -1 so they keep their "rolled" status but
 * can't win.
 */
export function rollForOrder(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]
  const { a, b } = rollFor(d)
  const sum = a + b
  d.orderRolls = { ...(d.orderRolls ?? {}), [player.id]: sum }
  log(d, "log.orderRolled", { name: player.nickname, a, b, sum })

  const pending = d.players.filter(
    (p) => !p.isBankrupt && d.orderRolls![p.id] === undefined
  )
  if (pending.length > 0) {
    d.currentPlayerIndex = d.players.findIndex((p) => p.id === pending[0].id)
    return d
  }

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

  const next: Record<string, number> = {}
  for (const p of contenders) {
    if (rolls[p.id] !== max) next[p.id] = -1
  }
  d.orderRolls = next
  d.currentPlayerIndex = d.players.findIndex((p) => p.id === top[0].id)
  log(d, "log.orderTie", { n: top.length, sum: max })
  return d
}

export function roll(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]
  if (player.inJail) return rollInJail(d, player)

  const { a, b } = rollFor(d)
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

/** Doubles free you (no extra turn); the third failed attempt forces the fine. */
function rollInJail(d: GameState, player: Player): GameState {
  const { a, b } = rollFor(d)
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

export function payJailFine(d: GameState): GameState {
  const player = currentPlayer(d)
  pay(d, player, JAIL_FINE, null)
  if (player.isBankrupt) return settleNoExtra(d)
  player.inJail = false
  player.jailTurns = 0
  log(d, "log.jailPaid", { name: player.nickname, fine: JAIL_FINE })
  return d // stays in awaiting-roll: the player still rolls to move
}

export function redeemJailCard(d: GameState): GameState {
  const player = currentPlayer(d)
  if (player.getOutOfJailCards <= 0) return d
  player.getOutOfJailCards -= 1
  player.inJail = false
  player.jailTurns = 0
  log(d, "log.jailCard", { name: player.nickname })
  return d
}

export function buy(d: GameState): GameState {
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
  d.phase = "awaiting-end"
  return settle(d)
}

export function decline(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]
  const tileId = d.pendingPurchase!
  log(d, "log.declinedBuy", {
    name: player.nickname,
    tile: tileDef(d, tileId).name,
  })
  d.pendingPurchase = null
  return openAuction(d, tileId)
}

/** A force-ended turn still collects a confirmed debt, so skipping a
 * disconnected player never dodges rent. */
export function collectPendingDebt(d: GameState): void {
  if (!d.pendingDebt) return
  const debt = d.pendingDebt
  d.pendingDebt = null
  pay(d, d.players[d.currentPlayerIndex], debt.amount, debt.creditorId)
}

export function endTurn(d: GameState): GameState {
  collectPendingDebt(d)

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
  tickEvent(d)
  maybeSpawnEvent(d)
  d.history = [...d.history, historyPoint(d, d.turnCount)]
  return d
}
