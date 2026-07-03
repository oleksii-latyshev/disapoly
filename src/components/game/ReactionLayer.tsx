import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import type { GameState } from "@/game"
import type { ReactionEvent } from "@/hooks/useRoom"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

import { tokenTargets } from "./board-meta"

type FloatItem = { key: number; emoji: string; x: number; y: number }

/**
 * Floating emoji reactions that rise from the reacting player's token. Fed by
 * the ephemeral `reactions` stream from the room socket (online only); each new
 * event spawns a short-lived emoji, mirroring the money-delta pattern.
 */
export function ReactionLayer({
  state,
  reactions,
}: {
  state: GameState
  reactions: ReactionEvent[]
}) {
  const reduce = usePrefersReducedMotion()
  const [items, setItems] = useState<FloatItem[]>([])
  const seen = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (reactions.length === 0) return
    const maxId = reactions[reactions.length - 1].id
    if (maxId <= seen.current) return

    const targets = tokenTargets(state.players.filter((p) => !p.isBankrupt))
    const spawned: FloatItem[] = []
    for (const r of reactions) {
      if (r.id <= seen.current) continue
      const at = targets.get(r.playerId)
      if (at) spawned.push({ key: r.id, emoji: r.emoji, x: at.x, y: at.y - 4 })
    }
    seen.current = maxId
    if (spawned.length === 0) return

    const keys = new Set(spawned.map((s) => s.key))
    // Ephemeral animation queue driven by incoming events — effect is correct here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems((cur) => [...cur, ...spawned])
    const tm = setTimeout(
      () => setItems((cur) => cur.filter((i) => !keys.has(i.key))),
      1800
    )
    timers.current.push(tm)
  }, [reactions, state.players])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <AnimatePresence>
        {items.map((it) => (
          <motion.div
            key={it.key}
            className="absolute text-[length:max(20px,3cqw)] drop-shadow"
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              translate: "-50% -50%",
            }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 0 }}
            animate={
              reduce
                ? { opacity: 1 }
                : { opacity: [0, 1, 1, 0], scale: 1.15, y: -42 }
            }
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.8,
              ease: "easeOut",
              times: reduce ? undefined : [0, 0.15, 0.7, 1],
            }}
          >
            {it.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
