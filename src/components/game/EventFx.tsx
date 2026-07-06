/* eslint-disable react-refresh/only-export-components -- the fx hook and its
   render layer are one unit; splitting them would separate the FX table from
   the components that consume it. */
/**
 * Per-event board animations for surprise events (settings.events): each kind
 * gets its own short, non-blocking effect — an earthquake shake, money rain, a
 * jail lock popping open, an audit stamp, a boom-day heat pulse. Log-driven
 * like EventAnnouncer, so it works identically in both play modes; everything
 * is skipped under reduced motion (the callouts still announce the event).
 */

import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"

import { jailTileId, type GameState } from "@/game"
import { useT } from "@/i18n"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

import { tileCenter } from "./board-meta"

type FxKind = "earthquake" | "windfall" | "jailbreak" | "taxAudit" | "rentSurge"

export type EventFx = { id: number; kind: FxKind }

/** Which log events trigger an effect, and how long it stays mounted. */
const FX: Record<string, { kind: FxKind; ms: number }> = {
  "log.eventEarthquake": { kind: "earthquake", ms: 900 },
  "log.eventWindfall": { kind: "windfall", ms: 2600 },
  "log.eventJailbreak": { kind: "jailbreak", ms: 1800 },
  "log.eventTaxAudit": { kind: "taxAudit", ms: 1800 },
  "log.eventRentSurge": { kind: "rentSurge", ms: 1800 },
}

/**
 * Watch the log for freshly fired surprise events and expose them as live
 * effects; each removes itself once its animation has played out. The caller
 * renders `EventFxLayer` with the result (and shakes the board on earthquake).
 */
export function useEventFx(state: GameState): EventFx[] {
  const [fx, setFx] = useState<EventFx[]>([])
  // Start from the latest entry so a fresh mount / reconnect doesn't replay history.
  const lastId = useRef<number | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    const seenUpTo = lastId.current
    const maxId = state.log.length ? state.log[state.log.length - 1].id : -1
    lastId.current = maxId
    if (seenUpTo === null) return // baseline only

    const fresh = state.log.filter((e) => e.id > seenUpTo && e.key in FX)
    // Guard against a big jump (reconnect): play only the most recent effect.
    for (const entry of fresh.slice(-1)) {
      const spec = FX[entry.key]
      setFx((cur) => [...cur, { id: entry.id, kind: spec.kind }])
      const timer = setTimeout(
        () => setFx((cur) => cur.filter((f) => f.id !== entry.id)),
        spec.ms
      )
      timers.current.push(timer)
    }
  }, [state])

  return fx
}

/** Money-rain notes: deterministic per-note styling so re-renders don't jitter. */
const NOTE_COUNT = 12
const NOTE_FACES = ["💵", "💸", "🪙"]

function MoneyRain({ seed }: { seed: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {Array.from({ length: NOTE_COUNT }, (_, i) => {
        const left = (seed * 37 + i * 83) % 100
        const delay = (i % 5) * 0.12
        const duration = 1.5 + (i % 3) * 0.35
        const spin = ((seed * 13 + i * 47) % 60) - 30
        return (
          <motion.span
            key={i}
            className="absolute text-[length:max(12px,1.8cqw)]"
            style={{ left: `${left}%` }}
            initial={{ top: "-8%", opacity: 0, rotate: 0 }}
            animate={{ top: "104%", opacity: [0, 1, 1, 0], rotate: spin }}
            transition={{ duration, delay, ease: "easeIn" }}
          >
            {NOTE_FACES[i % NOTE_FACES.length]}
          </motion.span>
        )
      })}
    </div>
  )
}

/** The lock pops open and floats up from the jail corner. */
function JailbreakPop({ state }: { state: GameState }) {
  const c = tileCenter(jailTileId(state), state.tiles.length)
  return (
    <motion.div
      className="pointer-events-none absolute z-30 text-[length:max(18px,3cqw)] drop-shadow-md"
      style={{ left: `${c.x}%`, top: `${c.y}%`, x: "-50%", y: "-50%" }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.4, 1.35, 1, 1],
        y: ["-50%", "-110%"],
      }}
      transition={{ duration: 1.7, ease: "easeOut" }}
    >
      🔓
    </motion.div>
  )
}

/** A red stamp slams onto the board center, then fades. */
function AuditStamp({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <motion.div
        className="rounded-lg border-[3px] border-rose-500 px-[max(10px,1.6cqw)] py-[max(4px,0.7cqw)] text-[length:max(13px,2.2cqw)] font-black tracking-widest text-rose-500 uppercase"
        style={{ backgroundColor: "rgba(244, 63, 94, 0.08)" }}
        initial={{ opacity: 0, scale: 2.4, rotate: -10 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [2.4, 1, 1, 1] }}
        transition={{ duration: 1.7, times: [0, 0.2, 0.8, 1], ease: "easeOut" }}
      >
        🕵️ {label}
      </motion.div>
    </div>
  )
}

/** A warm heat-glow pulse washes over the board when a boom day starts. */
function SurgeGlow() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 rounded-2xl"
      style={{ boxShadow: "inset 0 0 60px 18px rgba(249, 115, 22, 0.5)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.9, 0] }}
      transition={{ duration: 1.7, ease: "easeInOut" }}
    />
  )
}

/**
 * The transient overlays for live effects, rendered inside the board grid.
 * The earthquake has no overlay — the board itself shakes (see `board-quake`).
 */
export function EventFxLayer({
  fx,
  state,
}: {
  fx: EventFx[]
  state: GameState
}) {
  const t = useT()
  const reduce = usePrefersReducedMotion()
  if (reduce) return null

  return (
    <>
      {fx.map((f) => {
        switch (f.kind) {
          case "windfall":
            return <MoneyRain key={f.id} seed={f.id} />
          case "jailbreak":
            return <JailbreakPop key={f.id} state={state} />
          case "taxAudit":
            return <AuditStamp key={f.id} label={t("event.taxAudit")} />
          case "rentSurge":
            return <SurgeGlow key={f.id} />
          default:
            return null
        }
      })}
    </>
  )
}
