import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { animate, AnimatePresence, motion } from "motion/react"

import { BOARD_SIZE, type GameState, type Player } from "@/game"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

import { useBoardTheme } from "./board-theme"
import {
  cardStopoverTile,
  positionsOf,
  STOPOVER_PAUSE_MS,
  tileCenter,
  tokenTargets,
  travelPlan,
  travelSeconds,
  type TokenTarget as Target,
} from "./board-meta"

/**
 * Bounce keyframes for a travel animation: the piece arcs up once per hop
 * while its ground shadow shrinks and fades, so tokens read as jumping
 * tile-to-tile instead of sliding.
 */
function hopKeyframes(hops: number, lift: string) {
  const y: string[] = ["0%"]
  const shadowScale: number[] = [1]
  const shadowOpacity: number[] = [1]
  for (let i = 0; i < hops; i++) {
    y.push(lift, "0%")
    shadowScale.push(0.55, 1)
    shadowOpacity.push(0.4, 1)
  }
  return { y, shadowScale, shadowOpacity }
}

function Token({
  player,
  target,
  glow,
  stopoverFor,
}: {
  player: Player
  target: Target
  glow: boolean
  /** Card stop-over tile for this player's move, or null (see TokenLayer). */
  stopoverFor: (playerId: string, from: number) => number | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const prevPos = useRef(player.position)
  const mounted = useRef(false)
  const gen = useRef(0)
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduce = usePrefersReducedMotion()
  // Read through a ref so the travel effect doesn't re-run on identity
  // changes. Updated in a layout effect *declared before* the travel effect,
  // so the travel effect (same commit, runs later) sees the fresh value.
  const stopoverRef = useRef(stopoverFor)
  useLayoutEffect(() => {
    stopoverRef.current = stopoverFor
  })

  useEffect(
    () => () => {
      if (pauseTimer.current) clearTimeout(pauseTimer.current)
    },
    []
  )

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const place = () => {
      el.style.left = `${target.x}%`
      el.style.top = `${target.y}%`
    }

    const from = prevPos.current
    const to = player.position
    const posChanged = from !== to
    prevPos.current = to

    // A short pop when a token settles onto a new tile, so landings read clearly.
    const myGen = ++gen.current
    const pop = () => {
      if (reduce || gen.current !== myGen || !bodyRef.current) return
      animate(
        bodyRef.current,
        { scale: [1, 1.32, 1] },
        { duration: 0.34, ease: "easeOut" }
      )
    }

    // Arc the piece itself while the wrapper travels (see hopKeyframes).
    const bounce = (hops: number, lift: string, duration: number) => {
      const body = bodyRef.current
      const shadow = shadowRef.current
      if (reduce || !body || !shadow) return
      const kf = hopKeyframes(hops, lift)
      animate(body, { y: kf.y }, { duration, ease: "easeInOut" })
      animate(
        shadow,
        { scale: kf.shadowScale, opacity: kf.shadowOpacity },
        { duration, ease: "easeInOut" }
      )
    }

    // First paint, reduced motion, or offset-only shuffle: no travel animation.
    if (!mounted.current || reduce || !posChanged) {
      if (!mounted.current || reduce) {
        place()
      } else {
        animate(
          el,
          { left: `${target.x}%`, top: `${target.y}%` },
          { duration: 0.28 }
        )
      }
      mounted.current = true
      return
    }

    // One leg of travel: per-tile hops for a rollable distance, otherwise a
    // single big glide arc (teleports, long card moves).
    const leg = (
      legFrom: number,
      legTo: number,
      endX: number,
      endY: number
    ) => {
      const forward = (legTo - legFrom + BOARD_SIZE) % BOARD_SIZE
      const duration = travelSeconds(legFrom, legTo)
      if (forward >= 1 && forward <= 12) {
        // Hop through each intermediate tile, landing on the offset target.
        const xs: number[] = []
        const ys: number[] = []
        for (let step = 1; step <= forward; step++) {
          const c = tileCenter((legFrom + step) % BOARD_SIZE)
          xs.push(c.x)
          ys.push(c.y)
        }
        xs[xs.length - 1] = endX
        ys[ys.length - 1] = endY
        bounce(forward, "-55%", duration)
        return animate(
          el,
          { left: xs.map((n) => `${n}%`), top: ys.map((n) => `${n}%`) },
          { duration, ease: "easeInOut" }
        )
      }
      bounce(1, "-130%", duration)
      return animate(
        el,
        { left: `${endX}%`, top: `${endY}%` },
        { duration, ease: "easeInOut" }
      )
    }

    // A movement card first carries the token to the deck tile it was drawn
    // on; it pauses there while the card is revealed, then travels onward.
    const via = stopoverRef.current(player.id, from)
    if (via !== null && via !== to) {
      const c = tileCenter(via)
      leg(from, via, c.x, c.y).then(() => {
        if (gen.current !== myGen) return
        pop()
        if (pauseTimer.current) clearTimeout(pauseTimer.current)
        pauseTimer.current = setTimeout(() => {
          if (gen.current !== myGen) return
          leg(via, to, target.x, target.y).then(pop, () => {})
        }, STOPOVER_PAUSE_MS)
      }, () => {})
    } else {
      leg(from, to, target.x, target.y).then(pop, () => {})
    }
  }, [player.id, player.position, target.x, target.y, reduce])

  return (
    <div
      ref={ref}
      className="absolute size-[4.6%]"
      style={{ translate: "-50% -50%" }}
      title={player.nickname}
    >
      {/* Ground shadow — stays on the "floor" while the piece arcs above it. */}
      <div
        ref={shadowRef}
        className="absolute top-[68%] left-1/2 h-[38%] w-[82%] rounded-full bg-black/35 blur-[2px]"
        style={{ translate: "-50% 0" }}
      />
      {/* The piece: sphere-shaded so it reads as a 3D pawn, not a flat disc. */}
      <div
        ref={bodyRef}
        className="relative flex size-full items-center justify-center rounded-full border border-white/80 text-[10px] font-bold text-white"
        style={{
          background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${player.color} 55%, white), ${player.color} 58%, color-mix(in srgb, ${player.color} 68%, black))`,
          boxShadow: glow
            ? `0 0 10px ${player.color}, inset 0 -3px 5px rgba(0, 0, 0, 0.28)`
            : "inset 0 -3px 5px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.3)",
        }}
      >
        <span className="pointer-events-none absolute top-[10%] left-[16%] h-[28%] w-[40%] rounded-full bg-white/45 blur-[1px]" />
        <span className="relative drop-shadow-sm">
          {player.nickname.charAt(0).toUpperCase()}
        </span>
      </div>
    </div>
  )
}

/** A short-lived floating "+$X" / "−$X" that rises above a player's token. */
type Delta = { key: number; amount: number; x: number; y: number }

function MoneyDelta({ delta }: { delta: Delta }) {
  const gain = delta.amount > 0
  return (
    <motion.div
      className="absolute z-30 rounded-full px-1.5 py-0.5 text-[length:max(10px,1.25cqw)] font-extrabold tabular-nums shadow-sm"
      style={{
        left: `${delta.x}%`,
        top: `${delta.y}%`,
        // CSS `translate` centers horizontally without clobbering the motion
        // `transform` (which drives the rise + scale animation).
        translate: "-50% 0",
        color: "#fff",
        backgroundColor: gain ? "#16a34a" : "#dc2626",
      }}
      initial={{ opacity: 0, y: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: -46, scale: 1 }}
      transition={{ duration: 1.5, ease: "easeOut", times: [0, 0.15, 0.7, 1] }}
    >
      {gain ? "+" : "−"}${Math.abs(delta.amount)}
    </motion.div>
  )
}

/** Absolute overlay that renders and animates every active player's token. */
export function TokenLayer({ state }: { state: GameState }) {
  const { theme } = useBoardTheme()
  const reduce = usePrefersReducedMotion()
  const active = state.players.filter((p) => !p.isBankrupt)

  // Per-player target including the fan-out offset for co-located tokens.
  const targets = tokenTargets(active)

  // Floating money deltas, derived from each player's balance change.
  const [deltas, setDeltas] = useState<Delta[]>([])
  const prevBalances = useRef<Map<string, number> | null>(null)
  const prevPositions = useRef<Map<string, number> | null>(null)
  const nextKey = useRef(0)
  // Show/hide timers must survive unrelated effect re-runs (every state
  // update recreates `state.players`), so they're only cleared on unmount.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Stop-over lookup for the acting player's move (others never stop over).
  const current = state.players[state.currentPlayerIndex]
  const stopoverFor = (playerId: string, from: number) =>
    playerId === current?.id ? cardStopoverTile(state, from) : null

  useEffect(() => {
    const prev = prevBalances.current
    const prevPos = prevPositions.current
    const nextMap = new Map(state.players.map((p) => [p.id, p.balance]))
    prevBalances.current = nextMap
    prevPositions.current = positionsOf(state.players)
    if (!prev || reduce) return

    // If this update also moved a token (rent, tax, GO…), hold the delta
    // until the token lands (any card stop-over included) so the money
    // appears where the piece actually is.
    const delay = travelPlan(prevPos, state).totalMs

    // Recompute targets here (rather than reading a render value) so the effect
    // stays self-contained and lint-clean.
    const at = tokenTargets(state.players.filter((p) => !p.isBankrupt))
    const spawned: Delta[] = []
    for (const player of state.players) {
      const pos = at.get(player.id)
      const before = prev.get(player.id)
      if (!pos || before === undefined) continue
      const diff = player.balance - before
      if (diff !== 0) {
        spawned.push({
          key: nextKey.current++,
          amount: diff,
          x: pos.x,
          y: pos.y - 3,
        })
      }
    }
    if (spawned.length === 0) return

    const keys = new Set(spawned.map((d) => d.key))
    const show = setTimeout(() => {
      setDeltas((cur) => [...cur, ...spawned])
      const hide = setTimeout(
        () => setDeltas((cur) => cur.filter((d) => !keys.has(d.key))),
        1500
      )
      timers.current.push(hide)
    }, delay)
    timers.current.push(show)
  }, [state, reduce])

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {active.map((player) => (
        <Token
          key={player.id}
          player={player}
          target={targets.get(player.id)!}
          glow={theme.glow}
          stopoverFor={stopoverFor}
        />
      ))}
      <AnimatePresence>
        {deltas.map((d) => (
          <MoneyDelta key={d.key} delta={d} />
        ))}
      </AnimatePresence>
    </div>
  )
}
