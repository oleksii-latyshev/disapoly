import { animate } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { type GameState, netWorth, type RoomMember } from "@/core/game-core"
import { ConnectionIndicator } from "@/core/network"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import { cn } from "@/shared/lib/utils"

/**
 * A balance that rolls to its new value instead of snapping, with a brief
 * green/red flash so gains and losses register at a glance.
 */
function AnimatedBalance({ value }: { value: number }) {
  const reduce = usePrefersReducedMotion()
  const [display, setDisplay] = useState(value)
  const shown = useRef(value)
  const [flash, setFlash] = useState<"up" | "down" | null>(null)

  useEffect(() => {
    const from = shown.current
    if (from === value) return
    if (reduce) {
      shown.current = value
      return
    }
    // Ephemeral count-up animation — can't be derived during render.
    setFlash(value > from ? "up" : "down")
    const controls = animate(from, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => {
        shown.current = Math.round(v)
        setDisplay(shown.current)
      },
    })
    const timer = setTimeout(() => setFlash(null), 1100)
    return () => {
      controls.stop()
      clearTimeout(timer)
    }
  }, [value, reduce])

  return (
    <span
      className={cn(
        "block font-semibold transition-colors duration-700",
        flash === "up" && "text-emerald-600 dark:text-emerald-400",
        flash === "down" && "text-rose-600 dark:text-rose-400"
      )}
    >
      ${reduce ? value : display}
    </span>
  )
}

export function PlayersList({
  state,
  members,
  latencies,
}: {
  state: GameState
  /** Online only: room membership (for connection state) + measured pings. */
  members?: RoomMember[]
  latencies?: Record<string, number>
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {state.players.map((player, index) => {
        const isCurrent =
          index === state.currentPlayerIndex && state.status === "playing"
        const member = members?.find((m) => m.id === player.id)
        return (
          <div
            key={player.id}
            className={cn(
              "flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm",
              isCurrent && "ring-2 ring-primary",
              player.isBankrupt && "opacity-50"
            )}
          >
            {/* The avatar leads; the token color rides along as a small badge
                tucked under its corner (or stands alone without an emoji). */}
            {player.emoji ? (
              <span className="relative shrink-0 text-xl leading-none">
                {player.emoji}
                <span
                  className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border border-white/70"
                  style={{ backgroundColor: player.color }}
                />
              </span>
            ) : (
              <span
                className="size-3 shrink-0 rounded-full border border-white/70"
                style={{ backgroundColor: player.color }}
              />
            )}
            <span className="min-w-0 flex-1 truncate font-medium">
              {player.nickname}
              {state.orderRolls && (state.orderRolls[player.id] ?? -1) >= 0 && (
                <span className="ml-1 text-muted-foreground text-xs">
                  🎲 {state.orderRolls[player.id]}
                </span>
              )}
              {player.inJail && (
                <span className="ml-1 text-muted-foreground text-xs">
                  (jail)
                </span>
              )}
              {player.isBankrupt && (
                <span className="ml-1 text-destructive text-xs">
                  (bankrupt)
                </span>
              )}
            </span>
            {member && (
              <ConnectionIndicator
                connected={member.connected}
                ms={latencies?.[player.id]}
              />
            )}
            <span className="text-right tabular-nums">
              <AnimatedBalance value={player.balance} />
              <span className="block text-[10px] text-muted-foreground">
                net ${netWorth(state, player.id)}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
