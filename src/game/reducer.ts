/**
 * Pure rules engine: (state, action) -> state.
 *
 * No I/O, no randomness outside the seeded PRNG, no references to React. Every
 * action is an *intent*; the reducer validates it and applies the result
 * atomically. This is the piece the sync layer will drive in later stages.
 */

import {
  BOARD,
  BOARD_SIZE,
  GO_PAYOUT,
  JAIL_FINE,
  JAIL_TILE_ID,
} from "./board.config"
import { rollDice } from "./rng"
import {
  activePlayers,
  canBuildHouse,
  canMortgage,
  canSellHouse,
  canUnmortgage,
  currentPlayer,
  mortgageValue,
  rentFor,
  tileDef,
  unmortgageCost,
} from "./state"
import type { GameAction, GameState, Player, StreetTile } from "./types"

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.status !== "playing") return state

  switch (action.type) {
    case "ROLL_DICE":
      return state.phase === "awaiting-roll" ? roll(clone(state)) : state
    case "BUY_PROPERTY":
      return state.phase === "awaiting-buy" ? buy(clone(state)) : state
    case "DECLINE_PROPERTY":
      return state.phase === "awaiting-buy" ? decline(clone(state)) : state
    case "END_TURN":
      return state.phase === "awaiting-end" ? endTurn(clone(state)) : state
    case "BUILD_HOUSE":
      return canManage(state) ? buildHouse(clone(state), action.tileId) : state
    case "SELL_HOUSE":
      return canManage(state) ? sellHouse(clone(state), action.tileId) : state
    case "MORTGAGE":
      return canManage(state) ? mortgage(clone(state), action.tileId) : state
    case "UNMORTGAGE":
      return canManage(state) ? unmortgage(clone(state), action.tileId) : state
    default:
      return state
  }
}

/** Property management is allowed on your own turn, outside the buy step. */
function canManage(state: GameState): boolean {
  return state.phase === "awaiting-roll" || state.phase === "awaiting-end"
}

// --- action handlers (mutate the cloned draft, then return it) ---

function roll(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]

  if (player.inJail) {
    // Stage 0 simplification: pay the fine and leave; full jail is Stage 2.
    pay(d, player, JAIL_FINE, null)
    player.inJail = false
    log(d, `${player.nickname} paid $${JAIL_FINE} to leave jail.`)
  }

  const result = rollDice(d.rngSeed)
  d.rngSeed = result.seed
  d.dice = result.dice
  const [a, b] = result.dice
  const isDouble = a === b
  const sum = a + b
  log(d, `${player.nickname} rolled ${a} + ${b} = ${sum}${isDouble ? " (doubles)" : ""}.`)

  if (isDouble) d.doublesCount += 1
  if (isDouble && d.doublesCount === 3) {
    sendToJail(player)
    log(d, `${player.nickname} rolled three doubles and goes to jail!`)
    d.phase = "awaiting-end"
    return d
  }

  const from = player.position
  const to = (from + sum) % BOARD_SIZE
  if (to < from) {
    player.balance += GO_PAYOUT
    log(d, `${player.nickname} passed GO and collected $${GO_PAYOUT}.`)
  }
  player.position = to

  resolveLanding(d, sum)
  return settle(d)
}

function resolveLanding(d: GameState, diceSum: number): void {
  const player = d.players[d.currentPlayerIndex]
  const def = tileDef(player.position)

  switch (def.type) {
    case "tax":
      log(d, `${player.nickname} landed on ${def.name} and owes $${def.amount}.`)
      pay(d, player, def.amount, null)
      return

    case "goToJail":
      sendToJail(player)
      log(d, `${player.nickname} was sent to jail.`)
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
          log(d, `${player.nickname} can't afford ${def.name} ($${def.price}).`)
        }
      } else if (tile.ownerId !== player.id) {
        const rent = rentFor(d, def.id, diceSum)
        const owner = d.players.find((p) => p.id === tile.ownerId)!
        log(d, `${player.nickname} pays $${rent} rent to ${owner.nickname} for ${def.name}.`)
        pay(d, player, rent, owner.id)
      }
      return
    }

    default:
      // go, jail (just visiting), freeParking, chance, communityChest:
      // no effect in Stage 0.
      return
  }
}

function buy(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]
  const tileId = d.pendingPurchase!
  const def = tileDef(tileId)
  const price = "price" in def ? def.price : 0

  if (player.balance >= price) {
    player.balance -= price
    d.tiles[tileId].ownerId = player.id
    log(d, `${player.nickname} bought ${def.name} for $${price}.`)
  }
  d.pendingPurchase = null
  d.phase = "awaiting-end" // clear the buy gate so settle() can recompute
  return settle(d)
}

function decline(d: GameState): GameState {
  const player = d.players[d.currentPlayerIndex]
  const def = tileDef(d.pendingPurchase!)
  log(d, `${player.nickname} declined to buy ${def.name}.`)
  d.pendingPurchase = null
  d.phase = "awaiting-end" // clear the buy gate so settle() can recompute
  return settle(d)
}

function endTurn(d: GameState): GameState {
  d.doublesCount = 0
  d.pendingPurchase = null

  const count = d.players.length
  let next = d.currentPlayerIndex
  for (let i = 0; i < count; i++) {
    next = (next + 1) % count
    if (!d.players[next].isBankrupt) break
  }
  d.currentPlayerIndex = next
  d.phase = "awaiting-roll"
  return d
}

// --- property management (Stage 2) ---

function buildHouse(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canBuildHouse(d, player.id, tileId)) return d
  const def = tileDef(tileId) as StreetTile
  player.balance -= def.houseCost
  d.tiles[tileId].houses += 1
  const what = d.tiles[tileId].houses === 5 ? "a hotel" : "a house"
  log(d, `${player.nickname} built ${what} on ${def.name} for $${def.houseCost}.`)
  return d
}

function sellHouse(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canSellHouse(d, player.id, tileId)) return d
  const def = tileDef(tileId) as StreetTile
  const refund = Math.floor(def.houseCost / 2)
  d.tiles[tileId].houses -= 1
  player.balance += refund
  log(d, `${player.nickname} sold a building on ${def.name} for $${refund}.`)
  return d
}

function mortgage(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canMortgage(d, player.id, tileId)) return d
  const value = mortgageValue(tileId)
  d.tiles[tileId].mortgaged = true
  player.balance += value
  log(d, `${player.nickname} mortgaged ${tileDef(tileId).name} for $${value}.`)
  return d
}

function unmortgage(d: GameState, tileId: number): GameState {
  const player = currentPlayer(d)
  if (!canUnmortgage(d, player.id, tileId)) return d
  const cost = unmortgageCost(tileId)
  d.tiles[tileId].mortgaged = false
  player.balance -= cost
  log(d, `${player.nickname} lifted the mortgage on ${tileDef(tileId).name} for $${cost}.`)
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
  if (d.phase === "awaiting-buy") return d

  const player = d.players[d.currentPlayerIndex]
  const isDouble = !!d.dice && d.dice[0] === d.dice[1]
  d.phase =
    isDouble && !player.inJail && !player.isBankrupt
      ? "awaiting-roll"
      : "awaiting-end"
  return d
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
    ? d.players.find((p) => p.id === creditorId) ?? null
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
  for (const tile of d.tiles) {
    if (tile.ownerId === debtor.id) {
      tile.ownerId = creditorId
      tile.houses = 0
      // A creditor inherits the mortgage; assets returned to the bank are clear.
      if (!creditorId) tile.mortgaged = false
    }
  }
  log(d, `${debtor.nickname} went bankrupt!`)
  checkGameOver(d)
}

/**
 * Raise cash for an insolvent debtor up to `target`: sell buildings (half cost),
 * then mortgage clear properties (half price). Stops early once covered.
 */
function raiseCash(d: GameState, debtor: Player, target: number): void {
  for (const def of BOARD) {
    if (debtor.balance >= target) return
    if (def.type !== "street") continue
    const tile = d.tiles[def.id]
    if (tile.ownerId !== debtor.id) continue
    while (tile.houses > 0 && debtor.balance < target) {
      tile.houses -= 1
      debtor.balance += Math.floor(def.houseCost / 2)
    }
  }
  for (const def of BOARD) {
    if (debtor.balance >= target) return
    if (!("price" in def)) continue
    const tile = d.tiles[def.id]
    if (tile.ownerId !== debtor.id || tile.mortgaged) continue
    tile.mortgaged = true
    debtor.balance += Math.floor(def.price / 2)
  }
}

function sendToJail(player: Player): void {
  player.position = JAIL_TILE_ID
  player.inJail = true
}

function checkGameOver(d: GameState): void {
  const remaining = activePlayers(d)
  if (remaining.length <= 1) {
    d.status = "finished"
    d.winnerId = remaining[0]?.id ?? null
    log(d, remaining[0] ? `${remaining[0].nickname} wins the game!` : "Game over.")
  }
}

function log(d: GameState, text: string): void {
  d.log.push({ id: d.nextLogId, text })
  d.nextLogId += 1
}

/** Shallow-clone the parts of state that handlers mutate. */
function clone(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    tiles: state.tiles.map((t) => ({ ...t })),
    log: [...state.log],
  }
}
