/** Structured game-log helper, shared by the reducer and the event system. */

import type { GameState, LogParam } from "./types"

/**
 * Keep only the most recent log entries in state. The UI shows the last ~50 and
 * ids stay monotonic (via `nextLogId`), so capping is invisible while it bounds
 * the broadcast/persisted payload over a long match. Comfortably above what's
 * displayed, with headroom for the event-callout diff.
 */
const LOG_CAP = 100

export function log(
  d: GameState,
  key: string,
  params?: Record<string, LogParam>
): void {
  d.log.push({ id: d.nextLogId, key, params })
  d.nextLogId += 1
  if (d.log.length > LOG_CAP) d.log = d.log.slice(-LOG_CAP)
}
