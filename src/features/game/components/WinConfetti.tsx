import { useEffect, useRef } from "react"

import type { GameState } from "@/modules/game-core"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rot: number
  vr: number
  color: string
}

const FALLBACK = [
  "#f5a623",
  "#16a34a",
  "#2563eb",
  "#dc2626",
  "#a855f7",
  "#eab308",
]
const DURATION = 5000

/**
 * A brief, self-contained confetti burst when the game is won. Canvas-based so
 * it stays cheap (no extra DOM nodes) and needs no dependency. Skipped under
 * reduced-motion.
 */
export function WinConfetti({ state }: { state: GameState }) {
  const reduce = usePrefersReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wonRef = useRef(false)

  const won = state.status === "finished" && state.winnerId !== null

  useEffect(() => {
    if (!won || wonRef.current || reduce) return
    wonRef.current = true

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    const colors = state.players.map((p) => p.color).concat(FALLBACK)
    const particles: Particle[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.5,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 2 + Math.random() * 3.5,
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))

    const start = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const elapsed = now - start
      ctx.clearRect(0, 0, w, h)
      const fade = Math.max(
        0,
        1 - Math.max(0, elapsed - DURATION * 0.7) / (DURATION * 0.3)
      )
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.vx *= 0.99
        p.rot += p.vr
        if (p.y > h + 20) {
          p.y = -20
          p.x = Math.random() * w
          p.vy = 2 + Math.random() * 3
        }
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
      if (elapsed < DURATION) {
        raf = requestAnimationFrame(frame)
      } else {
        ctx.clearRect(0, 0, w, h)
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [won, reduce, state.players])

  // Reset the one-shot guard for a rematch (status returns to "playing").
  useEffect(() => {
    if (state.status === "playing") wonRef.current = false
  }, [state.status])

  if (!won) return null
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-hidden
    />
  )
}
