import { useEffect, useRef } from "react"

import type { GameState, LogEntry } from "@/game"
import { useT, type TFunction } from "@/i18n"

/** Translate a structured log entry, resolving any `{ t }` param to text. */
function render(entry: LogEntry, t: TFunction): string {
  const params: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(entry.params ?? {})) {
    params[k] = typeof v === "object" && v !== null && "t" in v ? t(v.t) : v
  }
  return t(entry.key, params)
}

export function GameLog({ state }: { state: GameState }) {
  const t = useT()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [state.log.length])

  // Most recent entries are most relevant; cap to keep the DOM light.
  const entries = state.log.slice(-50)

  return (
    <div className="flex h-40 flex-col overflow-y-auto rounded-md border bg-card p-2 text-xs">
      {entries.map((entry) => (
        <p key={entry.id} className="text-muted-foreground">
          {render(entry, t)}
        </p>
      ))}
      <div ref={endRef} />
    </div>
  )
}
