import type { GameState } from "../types"

/** Management is allowed on your own turn outside the buy step — including
 * `awaiting-pay`, so a debtor can sell/mortgage to raise the cash. */
export function canManage(state: GameState): boolean {
  return (
    state.phase === "awaiting-roll" ||
    state.phase === "awaiting-end" ||
    state.phase === "awaiting-pay"
  )
}

export function canLeaveJail(state: GameState): boolean {
  return (
    state.phase === "awaiting-roll" &&
    state.players[state.currentPlayerIndex].inJail
  )
}

/** Decide the phase after a landing resolves: doubles grant another roll. */
export function settle(d: GameState): GameState {
  if (d.status !== "playing") return d
  if (
    d.phase === "awaiting-buy" ||
    d.phase === "auction" ||
    d.phase === "awaiting-pay"
  )
    return d

  const player = d.players[d.currentPlayerIndex]
  const isDouble = !!d.dice && d.dice[0] === d.dice[1]
  d.phase =
    isDouble && !player.inJail && !player.isBankrupt
      ? "awaiting-roll"
      : "awaiting-end"
  return d
}

/** Like `settle`, but never grants an extra roll (jail-exit rolls don't). */
export function settleNoExtra(d: GameState): GameState {
  if (d.status !== "playing") return d
  if (
    d.phase !== "awaiting-buy" &&
    d.phase !== "auction" &&
    d.phase !== "awaiting-pay"
  ) {
    d.phase = "awaiting-end"
  }
  return d
}
