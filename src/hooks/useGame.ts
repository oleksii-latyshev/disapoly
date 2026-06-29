import { useCallback, useReducer } from "react"

import {
  createInitialState,
  gameReducer,
  type GameAction,
  type GameState,
  type PlayerSetup,
} from "@/game"

/**
 * Thin React binding around the pure game reducer. Stage 0 keeps state in
 * `useReducer`; later stages swap this dispatch for one that round-trips
 * intents through the sync layer, leaving components untouched.
 */
export function useGame(setups: PlayerSetup[], seed?: number) {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    (): GameState => createInitialState(setups, seed)
  )

  const send = useCallback((action: GameAction) => dispatch(action), [])

  return { state, send }
}
