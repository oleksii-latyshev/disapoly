import { currentPlayer } from "../helpers/selectors"
import type { GameAction, GameState } from "../types"
import { passBid, placeBid } from "./auction"
import { goBankrupt } from "./bankruptcy"
import { clone } from "./clone"
import { payDebt } from "./payments"
import { canLeaveJail, canManage } from "./phase"
import { buildHouse, mortgage, sellHouse, unmortgage } from "./property"
import { cancelTrade, proposeTrade, respondTrade } from "./trades"
import {
  buy,
  decline,
  endTurn,
  payJailFine,
  redeemJailCard,
  roll,
  rollForOrder,
} from "./turn"

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
      // During the roll-off there is no turn to end — the absent player's
      // order roll is made for them instead.
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
      // The debtor raises the cash themselves; the payment is only accepted
      // once their balance actually covers it.
      return state.phase === "awaiting-pay" &&
        state.pendingDebt !== null &&
        currentPlayer(state).balance >= state.pendingDebt.amount
        ? payDebt(clone(state))
        : state
    case "DECLARE_BANKRUPTCY":
      return goBankrupt(state, action.playerId, "log.resigned")
    case "FORCE_BANKRUPT":
      return goBankrupt(state, action.playerId, "log.removedBankrupt")
    default:
      return state
  }
}
