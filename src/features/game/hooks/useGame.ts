import { useCallback, useReducer } from "react"

import {
  createInitialState,
  gameReducer,
  type GameAction,
  type GameSettings,
  type GameState,
  type PlayerSetup,
} from "@/core/game-core"

/** Local (hot-seat) driver for the pure game reducer — the offline
 * counterpart to sending intents over the socket. */
export function useGame(
  setups: PlayerSetup[],
  seed?: number,
  settings?: GameSettings
) {
  const [state, dispatch] = useReducer(gameReducer, undefined, (): GameState =>
    createInitialState(setups, seed, settings)
  )

  const send = useCallback((action: GameAction) => dispatch(action), [])

  return { state, send }
}
