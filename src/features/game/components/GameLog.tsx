import { useEffect, useRef } from "react"

import type { GameState } from "@/core/game-core"
import { renderLog, useT } from "@/core/i18n"

export function GameLog({ state }: { state: GameState }) {
  const t = useT()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [])

  // Most recent entries are most relevant; cap to keep the DOM light.
  const entries = state.log.slice(-50)

  return (
    <div className="flex h-40 flex-col overflow-y-auto rounded-md border bg-card p-2 text-xs">
      {entries.map((entry) => (
        <p key={entry.id} className="text-muted-foreground">
          {renderLog(entry, t)}
        </p>
      ))}
      <div ref={endRef} />
    </div>
  )
}
