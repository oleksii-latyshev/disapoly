import { WifiOff } from "lucide-react"

import { cn } from "@/shared/lib/utils"

import { type ConnQuality, connectionQuality } from "../helpers/connection"

const DOT: Record<ConnQuality, string> = {
  offline: "bg-muted-foreground",
  unknown: "bg-muted-foreground/40",
  good: "bg-green-500",
  ok: "bg-amber-500",
  poor: "bg-red-500 animate-pulse",
}

/** A small signal dot (+ optional ms) showing a member's connection quality. */
export function ConnectionIndicator({
  connected,
  ms,
  showMs = true,
}: {
  connected: boolean
  ms: number | undefined
  showMs?: boolean
}) {
  const q = connectionQuality(connected, ms)
  if (q === "offline") {
    return <WifiOff className="size-3.5 shrink-0 text-muted-foreground" />
  }
  return (
    <span
      className="flex shrink-0 items-center gap-1"
      title={ms !== undefined ? `${ms}ms` : undefined}
    >
      <span className={cn("size-2 rounded-full", DOT[q])} />
      {showMs && ms !== undefined && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {ms}ms
        </span>
      )}
    </span>
  )
}
