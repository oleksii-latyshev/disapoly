/** Connection-quality buckets derived from a member's connected flag + ping. */
export type ConnQuality = "offline" | "unknown" | "good" | "ok" | "poor"

/** Round-trip thresholds (ms) for the "ok" and "poor" buckets. */
export const LATENCY_OK = 150
export const LATENCY_POOR = 400

export function connectionQuality(
  connected: boolean,
  ms: number | undefined
): ConnQuality {
  if (!connected) return "offline"
  if (ms === undefined) return "unknown"
  if (ms < LATENCY_OK) return "good"
  if (ms < LATENCY_POOR) return "ok"
  return "poor"
}
