import { useEffect, useRef } from "react"

import type { GameState } from "@/game"
import { positionsOf, travelPlan } from "@/components/game/board-meta"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
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
  const reduce = usePrefersReducedMotion()
  const prevRef = useRef<GameState | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = state
    if (!prev) return // first render: just record the baseline

    // Cues tied to landing on a tile (card draw, jail) wait for the token's
    // travel animation, so the sound plays when the piece actually arrives.
    // The card cue fires at the deck-tile stop-over; the rest at journey's end.
    const plan = reduce
      ? { cardRevealMs: 0, totalMs: 0 }
      : travelPlan(positionsOf(prev.players), state)
    const after = (ms: number, fn: () => void) => {
      if (ms === 0) fn()
      else setTimeout(fn, ms)
    }
    const onLanding = (fn: () => void) => after(plan.totalMs, fn)

    if (prev.dice !== state.dice && state.dice) play("dice")
    if (prev.lastCard !== state.lastCard && state.lastCard) {
      after(plan.cardRevealMs, () => play("card"))
    }
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
        onLanding(() => play("jail"))
        break
      }
    }
  }, [state, play, localPlayerId, reduce])
}
