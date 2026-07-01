import { useEffect, useRef } from "react"

import type { GameState } from "@/game"
import { useSound } from "@/sound/SoundProvider"

/**
 * Plays sound effects derived from changes in the game state, so it works the
 * same in hot-seat and online (everyone hears the active player's actions).
 *
 * `localPlayerId` (online only) personalizes a couple of cues to "you": a chime
 * when your turn begins and a distinct ding when a trade is offered to you.
 */
export function useGameSounds(state: GameState, localPlayerId?: string): void {
  const { play } = useSound()
  const prevRef = useRef<GameState | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = state
    if (!prev) return // first render: just record the baseline

    if (prev.dice !== state.dice && state.dice) play("dice")
    if (prev.lastCard !== state.lastCard && state.lastCard) play("card")
    if (!prev.pendingTrade && state.pendingTrade) {
      // A distinct chime when the offer is addressed to you.
      play(
        localPlayerId && state.pendingTrade.toId === localPlayerId
          ? "offer"
          : "trade"
      )
    }
    if (prev.status !== "finished" && state.status === "finished") play("win")

    // Chime when it becomes your turn (online: only for the local player).
    if (
      localPlayerId &&
      state.status === "playing" &&
      prev.currentPlayerIndex !== state.currentPlayerIndex &&
      state.players[state.currentPlayerIndex]?.id === localPlayerId
    ) {
      play("turn")
    }

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
  }, [state, play, localPlayerId])
}
