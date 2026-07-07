import type { GameState, LogParam } from "../types"

// Bounds the broadcast/persisted payload; ids stay monotonic via nextLogId,
// so the UI (which shows ~50 entries) never notices the cap.
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
