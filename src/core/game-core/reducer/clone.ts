import type { GameState } from "../types"

/** Shallow-clone the parts of state that action handlers mutate. */
export function clone(state: GameState): GameState {
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
