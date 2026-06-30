import { useEffect, useRef } from "react"

import type { GameState } from "@/game"
import { useSound } from "@/sound/SoundProvider"

/**
 * Plays sound effects derived from changes in the game state, so it works the
 * same in hot-seat and online (everyone hears the active player's actions).
 */
export function useGameSounds(state: GameState): void {
  const { play } = useSound()
  const prevRef = useRef<GameState | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = state
    if (!prev) return // first render: just record the baseline

    if (prev.dice !== state.dice && state.dice) play("dice")
    if (prev.lastCard !== state.lastCard && state.lastCard) play("card")
    if (!prev.pendingTrade && state.pendingTrade) play("trade")
    if (prev.status !== "finished" && state.status === "finished") play("win")

    for (let i = 0; i < state.tiles.length; i++) {
      if (!prev.tiles[i].ownerId && state.tiles[i].ownerId) {
        play("buy")
        break
      }
    }
    for (let i = 0; i < state.tiles.length; i++) {
      if (state.tiles[i].houses > prev.tiles[i].houses) {
        play("build")
        break
      }
    }
    for (let i = 0; i < state.players.length; i++) {
      if (state.players[i].inJail && !prev.players[i].inJail) {
        play("jail")
        break
      }
    }
  }, [state, play])
}
