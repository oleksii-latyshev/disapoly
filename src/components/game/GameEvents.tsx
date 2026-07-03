import type { GameState } from "@/game"

import { CardReveal } from "./CardReveal"
import { EventAnnouncer } from "./EventAnnouncer"
import { TurnBanner } from "./TurnBanner"
import { WinConfetti } from "./WinConfetti"

/**
 * All the transient "juice" overlays that react to game-state changes: pivotal
 * event callouts, the card-draw reveal, and win confetti. Rendered once per
 * screen, shared by hot-seat and online. (Token movement / money deltas live in
 * the TokenLayer since they need per-token positions.)
 */
export function GameEvents({ state }: { state: GameState }) {
  return (
    <>
      <EventAnnouncer state={state} />
      <CardReveal state={state} />
      <TurnBanner state={state} />
      <WinConfetti state={state} />
    </>
  )
}
