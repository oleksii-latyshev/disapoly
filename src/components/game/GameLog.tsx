import { useEffect, useRef } from "react"

import type { GameState } from "@/game"

export function GameLog({ state }: { state: GameState }) {
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
          {entry.text}
        </p>
      ))}
      <div ref={endRef} />
    </div>
  )
}
