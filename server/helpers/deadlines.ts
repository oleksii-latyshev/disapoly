import {
  abandonMatch,
  autoBankruptOverdue,
  autoSkip,
  isAbandonable,
  nextAutoBankruptAt,
  type RoomState,
  shouldAutoSkip,
} from "../../src/core/game-core/room"
import { ABANDON_MS, AUTO_SKIP_MS } from "../constants"

/** When an emptied-out room's match should be abandoned, or null. */
export function abandonDeadline(state: RoomState, now: number): number | null {
  if (!isAbandonable(state)) return null
  const lastLeft = Math.max(
    0,
    ...state.members.map((m) => m.disconnectedAt ?? 0)
  )
  return (lastLeft || now) + ABANDON_MS
}

/** Reconcile `autoSkipAt` with reality: the countdown starts when the stall
 * is first noticed and survives resyncs; it clears when the stall ends. */
export function withAutoSkipDeadline(state: RoomState, now: number): RoomState {
  const skipAt = shouldAutoSkip(state)
    ? (state.autoSkipAt ?? now + AUTO_SKIP_MS)
    : null
  return state.autoSkipAt === skipAt ? state : { ...state, autoSkipAt: skipAt }
}

/**
 * The earliest deadline the room's single alarm must be armed for — skip the
 * absent current player, force-bankrupt an overdue absentee, or abandon an
 * empty room's match — or null when nothing is pending.
 */
export function nextAlarmAt(state: RoomState, now: number): number | null {
  const deadlines = [
    state.autoSkipAt,
    abandonDeadline(state, now),
    nextAutoBankruptAt(state),
  ].filter((n): n is number => n !== null)
  return deadlines.length === 0 ? null : Math.min(...deadlines)
}

/** Run every alarm duty whose deadline has passed. */
export function runAlarmDuties(
  state: RoomState,
  now: number
): { state: RoomState; abandoned: boolean } {
  let next = state
  if (
    next.autoSkipAt !== null &&
    now >= next.autoSkipAt &&
    shouldAutoSkip(next)
  ) {
    next = { ...autoSkip(next), autoSkipAt: null }
  }

  next = autoBankruptOverdue(next, now)

  const abandonAt = abandonDeadline(next, now)
  if (abandonAt !== null && now >= abandonAt) {
    return { state: abandonMatch(next), abandoned: true }
  }
  return { state: next, abandoned: false }
}
