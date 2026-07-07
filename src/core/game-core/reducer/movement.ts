import { GO_PAYOUT, moveTargetTile } from "../constants/board"
import { type CardEffect, CHANCE, COMMUNITY_CHEST } from "../constants/cards"
import {
  claimEventAt,
  goPayoutMultiplier,
  isRentFrozen,
  rentMultiplier,
} from "../helpers/events"
import { log } from "../helpers/log"
import { shuffle } from "../helpers/rng"
import {
  boardOf,
  boardSizeOf,
  currentPlayer,
  jailTileId,
  rentFor,
  tileDef,
} from "../helpers/selectors"
import type { GameState, Player } from "../types"
import { openAuction } from "./auction"
import { charge, pay } from "./payments"

/** Advance a player by `steps`, paying the GO bonus when passing it. */
export function moveBy(d: GameState, player: Player, steps: number): void {
  const from = player.position
  const to = (from + steps) % boardSizeOf(d)
  if (to < from) {
    const payout = GO_PAYOUT * goPayoutMultiplier(d)
    player.balance += payout
    log(d, "log.passGo", { name: player.nickname, amount: payout })
  }
  player.position = to
}

export function sendToJail(d: GameState, player: Player): void {
  player.position = jailTileId(d)
  player.inJail = true
  player.jailTurns = 0
}

export function resolveLanding(d: GameState, diceSum: number): void {
  const player = d.players[d.currentPlayerIndex]
  const def = tileDef(d, player.position)

  // An event prize on this tile pays out first, so it can help cover the rent.
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
        if (isRentFrozen(d)) {
          log(d, "log.rentFrozen", { name: player.nickname, tile: def.name })
          return
        }
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
      return
  }
}

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
