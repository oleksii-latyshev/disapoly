import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import type { GameState } from "@/core/game-core"
import { useT } from "@/core/i18n"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"

type Banner = { key: number; name: string; color: string }

/**
 * A ribbon that sweeps across the screen when the turn passes to the next
 * player: a translucent band in the player's color expands from the center
 * while their name slides in, holds a beat, and slides out. Skipped on mount
 * (no replay for late joiners / reconnects) and reduced to a plain fade under
 * prefers-reduced-motion.
 */
export function TurnBanner({ state }: { state: GameState }) {
  const t = useT()
  const reduce = usePrefersReducedMotion()
  const [banner, setBanner] = useState<Banner | null>(null)
  const prevId = useRef<string | null>(null)
  const nextKey = useRef(0)
  // The hide timer lives in a ref and is never cancelled by effect re-runs:
  // `state.players` is a fresh array on every update, so a cleanup-based timer
  // would be cancelled by any action within the 1.6s window, freezing the
  // banner on screen. Cleared on unmount or when a newer banner replaces it.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    []
  )

  useEffect(() => {
    const current =
      state.status === "playing"
        ? state.players[state.currentPlayerIndex]
        : undefined
    const before = prevId.current
    prevId.current = current?.id ?? null
    // Baseline on first observation; only announce an actual handoff.
    if (!current || before === null || current.id === before) return

    // Ephemeral, self-clearing announcement — can't be derived during render.
    setBanner({
      key: ++nextKey.current,
      name: current.nickname,
      color: current.color,
    })
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setBanner(null), 1600)
  }, [state.currentPlayerIndex, state.status, state.players])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[30svh] z-30">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.key}
            className="relative flex items-center justify-center overflow-hidden py-3.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Color band expanding from the center. */}
            <motion.div
              className="absolute inset-y-0 w-full"
              style={{
                background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${banner.color} 28%, transparent) 20%, color-mix(in srgb, ${banner.color} 28%, transparent) 80%, transparent)`,
              }}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={reduce ? { opacity: 0 } : { scaleX: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              className="relative flex items-center gap-2.5 text-xl font-black tracking-wide text-foreground drop-shadow-sm sm:text-2xl"
              initial={reduce ? false : { x: -72, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { x: 72, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Mini token matching the board pieces' sphere shading. */}
              <span
                className="size-5 rounded-full border border-white/80 sm:size-6"
                style={{
                  background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${banner.color} 55%, white), ${banner.color} 58%, color-mix(in srgb, ${banner.color} 68%, black))`,
                  boxShadow: "inset 0 -2px 4px rgba(0, 0, 0, 0.25)",
                }}
              />
              {t("turn.turnOf", { name: banner.name })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
