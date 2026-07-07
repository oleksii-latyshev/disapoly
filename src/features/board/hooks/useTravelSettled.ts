import { useEffect, useRef, useState } from "react"

import type { GameState } from "@/core/game-core"
import { positionsOf, travelPlan } from "@/core/board"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"

/**
 * False while a token-travel animation from the latest state update is still
 * playing (including a card stop-over leg), true once everything has landed.
 * Used to hold turn actions until the piece visibly reaches its tile.
 */
export function useTravelSettled(state: GameState): boolean {
  const reduce = usePrefersReducedMotion()
  const [settled, setSettled] = useState(true)
  const prevPositions = useRef<Map<string, number> | null>(null)
  // The pending timer survives unrelated state updates (a trade offer mid-hop
  // must not strand `settled` at false); cleared on unmount only.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  useEffect(() => {
    const delay = reduce ? 0 : travelPlan(prevPositions.current, state).totalMs
    prevPositions.current = positionsOf(state.players)
    if (delay === 0) return
    if (timer.current) clearTimeout(timer.current)
    setSettled(false)
    timer.current = setTimeout(() => setSettled(true), delay)
  }, [state, reduce])

  return settled
}
