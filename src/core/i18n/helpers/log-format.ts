import type { LogEntry } from "@/core/game-core"
import type { TFunction } from "../context"

/** Translate a structured log entry, resolving any `{ t }` param to text. */
export function renderLog(entry: LogEntry, t: TFunction): string {
  const params: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(entry.params ?? {})) {
    params[k] = typeof v === "object" && v !== null && "t" in v ? t(v.t) : v
  }
  return t(entry.key, params)
}
