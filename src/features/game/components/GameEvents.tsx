import type { GameState } from "@/core/game-core"

import { CardReveal } from "./CardReveal"
import { TurnBanner } from "./TurnBanner"
import { WinConfetti } from "./WinConfetti"

/**
 * All the transient "juice" overlays that react to game-state changes: the
 * card-draw reveal, turn-handoff banner, and win confetti. Rendered once per
 * screen, shared by hot-seat and online. (Event callouts live in the GameBoard
 * so they can anchor above the dice; token movement / money deltas live in the
 * TokenLayer since they need per-token positions.)
 */
export function GameEvents({ state }: { state: GameState }) {
  return (
    <>
      <CardReveal state={state} />
      <TurnBanner state={state} />
      <WinConfetti state={state} />
    </>
  )
}
