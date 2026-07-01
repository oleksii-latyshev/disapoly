import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { animate, AnimatePresence, motion } from "motion/react"

import { BOARD_SIZE, type GameState, type Player } from "@/game"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

import { useBoardTheme } from "./board-theme"
import { tileCenter } from "./board-meta"

/** Small fan-out offsets (in % of board) when several tokens share a tile. */
const OFFSETS: [number, number][] = [
  [0, 0],
  [-1.7, -1.7],
  [1.7, -1.7],
  [-1.7, 1.7],
  [1.7, 1.7],
  [0, -2],
  [0, 2],
  [-2, 0],
]

type Target = { x: number; y: number }

/** Per-player token targets, fanning out co-located tokens so they don't stack. */
function buildTargets(active: Player[]): Map<string, Target> {
  const counters: Record<number, number> = {}
  const targets = new Map<string, Target>()
  for (const player of active) {
    const seen = counters[player.position] ?? 0
    counters[player.position] = seen + 1
    const [dx, dy] = OFFSETS[Math.min(seen, OFFSETS.length - 1)]
    const c = tileCenter(player.position)
    targets.set(player.id, { x: c.x + dx, y: c.y + dy })
  }
  return targets
}

function Token({
  player,
  target,
  glow,
}: {
  player: Player
  target: Target
  glow: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const prevPos = useRef(player.position)
  const mounted = useRef(false)
  const gen = useRef(0)
  const reduce = usePrefersReducedMotion()

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
      if (reduce || gen.current !== myGen || !ref.current) return
      animate(ref.current, { scale: [1, 1.32, 1] }, { duration: 0.34, ease: "easeOut" })
    }

    // First paint, reduced motion, or offset-only shuffle: no travel animation.
    if (!mounted.current || reduce || !posChanged) {
      if (!mounted.current || reduce) {
        place()
      } else {
        animate(el, { left: `${target.x}%`, top: `${target.y}%` }, { duration: 0.28 })
      }
      mounted.current = true
      return
    }

    const forward = (to - from + BOARD_SIZE) % BOARD_SIZE
    if (forward >= 1 && forward <= 12) {
      // Hop through each intermediate tile, landing on the offset target.
      const xs: number[] = []
      const ys: number[] = []
      for (let step = 1; step <= forward; step++) {
        const c = tileCenter((from + step) % BOARD_SIZE)
        xs.push(c.x)
        ys.push(c.y)
      }
      xs[xs.length - 1] = target.x
      ys[ys.length - 1] = target.y
      animate(
        el,
        { left: xs.map((n) => `${n}%`), top: ys.map((n) => `${n}%`) },
        { duration: Math.min(0.2 * forward, 2.2), ease: "easeInOut" }
      ).then(pop, () => {})
    } else {
      // Teleport (e.g. go to jail) or long card move: glide directly, a bit
      // slower so the jump is legible rather than an instant snap.
      animate(
        el,
        { left: `${target.x}%`, top: `${target.y}%` },
        { duration: 0.75, ease: "easeInOut" }
      ).then(pop, () => {})
    }
  }, [player.position, target.x, target.y, reduce])

  return (
    <div
      ref={ref}
      className="absolute flex size-[4.6%] items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-md"
      style={{
        translate: "-50% -50%",
        backgroundColor: player.color,
        boxShadow: glow ? `0 0 8px ${player.color}` : undefined,
      }}
      title={player.nickname}
    >
      {player.nickname.charAt(0).toUpperCase()}
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
  const targets = buildTargets(active)

  // Floating money deltas, derived from each player's balance change.
  const [deltas, setDeltas] = useState<Delta[]>([])
  const prevBalances = useRef<Map<string, number> | null>(null)
  const nextKey = useRef(0)

  useEffect(() => {
    const prev = prevBalances.current
    const nextMap = new Map(state.players.map((p) => [p.id, p.balance]))
    prevBalances.current = nextMap
    if (!prev || reduce) return

    // Recompute targets here (rather than reading a render value) so the effect
    // stays self-contained and lint-clean.
    const at = buildTargets(state.players.filter((p) => !p.isBankrupt))
    const spawned: Delta[] = []
    for (const player of state.players) {
      const pos = at.get(player.id)
      const before = prev.get(player.id)
      if (!pos || before === undefined) continue
      const diff = player.balance - before
      if (diff !== 0) {
        spawned.push({ key: nextKey.current++, amount: diff, x: pos.x, y: pos.y - 3 })
      }
    }
    if (spawned.length === 0) return

    const keys = new Set(spawned.map((d) => d.key))
    // Ephemeral, self-clearing animation queue driven by balance changes — an
    // effect is the right tool here (this can't be derived during render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeltas((cur) => [...cur, ...spawned])
    const timer = setTimeout(
      () => setDeltas((cur) => cur.filter((d) => !keys.has(d.key))),
      1500
    )
    return () => clearTimeout(timer)
  }, [state.players, reduce])

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {active.map((player) => (
        <Token
          key={player.id}
          player={player}
          target={targets.get(player.id)!}
          glow={theme.glow}
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
