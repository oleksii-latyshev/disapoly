import { useLayoutEffect, useRef } from "react"
import { animate } from "motion/react"

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

    // First paint, reduced motion, or offset-only shuffle: no travel animation.
    if (!mounted.current || reduce || !posChanged) {
      if (!mounted.current || reduce) {
        place()
      } else {
        animate(el, { left: `${target.x}%`, top: `${target.y}%` }, { duration: 0.2 })
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
        { duration: Math.min(0.13 * forward, 1.3), ease: "easeInOut" }
      )
    } else {
      // Teleport (e.g. go to jail) or long card move: glide directly.
      animate(
        el,
        { left: `${target.x}%`, top: `${target.y}%` },
        { duration: 0.45, ease: "easeInOut" }
      )
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

/** Absolute overlay that renders and animates every active player's token. */
export function TokenLayer({ state }: { state: GameState }) {
  const { theme } = useBoardTheme()
  const active = state.players.filter((p) => !p.isBankrupt)

  // Per-player target including the fan-out offset for co-located tokens.
  const counters: Record<number, number> = {}
  const targets = new Map<string, Target>()
  for (const player of active) {
    const seen = counters[player.position] ?? 0
    counters[player.position] = seen + 1
    const [dx, dy] = OFFSETS[Math.min(seen, OFFSETS.length - 1)]
    const c = tileCenter(player.position)
    targets.set(player.id, { x: c.x + dx, y: c.y + dy })
  }

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
    </div>
  )
}
