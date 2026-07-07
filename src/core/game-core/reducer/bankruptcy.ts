import { reclaimBuildings } from "../helpers/buildings"
import { log } from "../helpers/log"
import { playerById } from "../helpers/selectors"
import type { GameState } from "../types"
import { dropFromAuction } from "./auction"
import { clone } from "./clone"
import { checkGameOver } from "./payments"
import { dropTradesWith } from "./trades"
import { collectPendingDebt, endTurn } from "./turn"

/**
 * Remove a player outside the normal insolvency path (voluntary surrender or a
 * force-removed absentee). A confirmed pending debt is collected first — that
 * alone may bankrupt them to the creditor. Otherwise their properties return
 * to the bank unowned and unmortgaged, up for grabs again.
 */
export function goBankrupt(
  state: GameState,
  playerId: string,
  logKey: string
): GameState {
  const target = playerById(state, playerId)
  if (!target || target.isBankrupt || state.status !== "playing") return state

  const d = clone(state)
  const player = playerById(d, playerId)!

  if (d.players[d.currentPlayerIndex].id === playerId) collectPendingDebt(d)

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

  dropTradesWith(d, playerId)
  dropFromAuction(d, playerId)

  if (
    d.status === "playing" &&
    d.phase !== "auction" &&
    d.players[d.currentPlayerIndex].id === playerId
  ) {
    return endTurn(d)
  }
  return d
}
