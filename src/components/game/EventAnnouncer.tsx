import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowRightLeft,
  Banknote,
  Building2,
  CircleDollarSign,
  Gavel,
  Hammer,
  Home,
  Landmark,
  Siren,
  Skull,
  type LucideIcon,
} from "lucide-react"

import type { GameState, LogEntry } from "@/game"
import { useT } from "@/i18n"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

import { positionsOf, settleDelayMs } from "./board-meta"
import { renderLog } from "./log-format"

type Tone = "good" | "bad" | "neutral"

/** Which log events surface as a big center-screen callout, and how they look. */
const CALLOUTS: Record<string, { icon: LucideIcon; tone: Tone }> = {
  "log.bought": { icon: Home, tone: "good" },
  "log.rent": { icon: Banknote, tone: "bad" },
  "log.tax": { icon: Landmark, tone: "bad" },
  "log.toJail": { icon: Siren, tone: "bad" },
  "log.threeDoubles": { icon: Siren, tone: "bad" },
  "log.passGo": { icon: CircleDollarSign, tone: "good" },
  "log.bankrupt": { icon: Skull, tone: "bad" },
  "log.auctionStart": { icon: Gavel, tone: "neutral" },
  "log.auctionWon": { icon: Gavel, tone: "good" },
  "log.builtHouse": { icon: Hammer, tone: "good" },
  "log.builtHotel": { icon: Building2, tone: "good" },
  "log.tradeProposed": { icon: ArrowRightLeft, tone: "neutral" },
  "log.tradeAccepted": { icon: ArrowRightLeft, tone: "neutral" },
}

const TONE_CLASS: Record<Tone, string> = {
  good: "border-emerald-500/40 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
  bad: "border-rose-500/40 bg-rose-500/15 text-rose-950 dark:text-rose-100",
  neutral: "border-sky-500/40 bg-sky-500/15 text-sky-950 dark:text-sky-100",
}

const ICON_CLASS: Record<Tone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-rose-600 dark:text-rose-400",
  neutral: "text-sky-600 dark:text-sky-400",
}

type Callout = { id: number; text: string; tone: Tone; icon: LucideIcon }

/**
 * Callouts for the pivotal, easy-to-miss moments (bought a property, sent to
 * jail, went bankrupt…). Derived from newly added log entries — the same
 * localized events the log shows — so it works in both play modes. Rendered as
 * an absolute overlay inside the board, stacked above the dice; when the
 * triggering update also moved a token, the callout waits for it to land.
 */
export function EventAnnouncer({ state }: { state: GameState }) {
  const t = useT()
  const reduce = usePrefersReducedMotion()
  const [items, setItems] = useState<Callout[]>([])
  // Start from the latest entry so a fresh mount / reconnect doesn't replay history.
  const lastId = useRef<number | null>(null)
  const prevPositions = useRef<Map<string, number> | null>(null)
  // Show/hide timers survive unrelated effect re-runs (every state update
  // would otherwise cancel them and strand callouts); cleared on unmount only.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    // Hold callouts until the moving token lands on its tile (rent, jail…).
    const delay = reduce
      ? 0
      : settleDelayMs(prevPositions.current, state.players)
    prevPositions.current = positionsOf(state.players)

    const seenUpTo = lastId.current
    const maxId = state.log.length ? state.log[state.log.length - 1].id : -1
    lastId.current = maxId
    if (seenUpTo === null) return // baseline only

    const fresh: LogEntry[] = state.log.filter((e) => e.id > seenUpTo)
    // Guard against a big jump (reconnect): only surface the most recent few.
    const picked = fresh
      .filter((e) => e.key in CALLOUTS)
      .slice(-3)
      .map((e) => {
        const c = CALLOUTS[e.key]
        return { id: e.id, text: renderLog(e, t), tone: c.tone, icon: c.icon }
      })
    if (picked.length === 0) return

    const ids = new Set(picked.map((p) => p.id))
    const show = setTimeout(() => {
      setItems((cur) => [...cur, ...picked].slice(-3))
      const hide = setTimeout(
        () => setItems((cur) => cur.filter((c) => !ids.has(c.id))),
        2600
      )
      timers.current.push(hide)
    }, delay)
    timers.current.push(show)
  }, [state, t, reduce])

  return (
    <div className="pointer-events-none absolute inset-x-[6%] top-[11%] z-30 flex flex-col items-center gap-[max(4px,0.6cqw)]">
      <AnimatePresence>
        {items.map((c) => {
          const Icon = c.icon
          return (
            <motion.div
              key={c.id}
              layout={!reduce}
              initial={
                reduce ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.9 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }
              }
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={
                "flex max-w-full items-center gap-[max(6px,0.9cqw)] rounded-full border px-[max(10px,1.5cqw)] py-[max(4px,0.7cqw)] text-[length:max(10px,1.5cqw)] font-semibold shadow-lg backdrop-blur-sm " +
                TONE_CLASS[c.tone]
              }
            >
              <Icon
                className={
                  "size-[max(13px,1.9cqw)] shrink-0 " + ICON_CLASS[c.tone]
                }
              />
              <span className="min-w-0 truncate">{c.text}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
