import { animate, motion } from "motion/react"
import { useEffect, useRef } from "react"

import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"

const SIZE = 44
const HALF = SIZE / 2

/** Which die value sits on each cube face, and how to place that face. */
const FACES: { value: number; transform: string }[] = [
  { value: 1, transform: `translateZ(${HALF}px)` },
  { value: 6, transform: `rotateY(180deg) translateZ(${HALF}px)` },
  { value: 2, transform: `rotateY(90deg) translateZ(${HALF}px)` },
  { value: 5, transform: `rotateY(-90deg) translateZ(${HALF}px)` },
  { value: 3, transform: `rotateX(90deg) translateZ(${HALF}px)` },
  { value: 4, transform: `rotateX(-90deg) translateZ(${HALF}px)` },
]

/** Cube rotation that brings each value to the front. */
const SHOW: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
}

/** Pip positions (1–9 grid cells) for each die value. */
const PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 4, 7, 3, 6, 9],
}

function Face({ value, transform }: { value: number; transform: string }) {
  const pips = new Set(PIPS[value])
  return (
    <div
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-px rounded-[6px] p-1.5"
      style={{
        transform,
        backfaceVisibility: "hidden",
        background: "linear-gradient(145deg, #ffffff 0%, #e9e9f0 100%)",
        boxShadow:
          "inset 0 0 0 1px rgba(0,0,0,0.08), inset 0 -4px 6px rgba(0,0,0,0.06)",
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center">
          {pips.has(i + 1) && (
            <span className="size-1.5 rounded-full bg-zinc-800" />
          )}
        </span>
      ))}
    </div>
  )
}

function Die({
  value,
  spins,
  delay,
  reduce,
}: {
  value: number
  spins: number
  delay: number
  reduce: boolean
}) {
  const target = SHOW[value]
  const bounceRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)

  // Throw arc: the cube lifts off and lands with a small bounce while its
  // floor shadow shrinks mid-air and snaps back on impact. Re-runs per roll.
  useEffect(() => {
    const cube = bounceRef.current
    const shadow = shadowRef.current
    if (reduce || !cube || !shadow) return
    const times = [0, 0.32, 0.62, 0.8, 1]
    const options = { duration: 0.9, delay, times, ease: "easeInOut" as const }
    animate(cube, { y: [0, -16, 0, -5, 0] }, options)
    animate(
      shadow,
      {
        scale: [1, 0.6, 1.08, 0.88, 1],
        opacity: [0.35, 0.14, 0.4, 0.28, 0.35],
      },
      options
    )
  }, [delay, reduce])

  return (
    <div className="relative">
      <div
        ref={shadowRef}
        className="absolute top-full left-1/2 h-2.5 w-11 rounded-full bg-black/60 blur-[3px]"
        style={{ translate: "-50% 2px", opacity: 0.35 }}
      />
      <div ref={bounceRef}>
        <motion.div
          className="relative"
          style={{
            width: SIZE,
            height: SIZE,
            transformStyle: "preserve-3d",
          }}
          animate={{
            rotateX: target.x + 360 * 2 * spins,
            rotateY: target.y + 360 * 2 * spins,
          }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.85, ease: [0.2, 0.8, 0.2, 1], delay }
          }
        >
          {FACES.map((f) => (
            <Face key={f.value} value={f.value} transform={f.transform} />
          ))}
        </motion.div>
      </div>
    </div>
  )
}

/**
 * Two tumbling 3D dice. `rollSeq` is a counter that increments on every roll;
 * each increment adds full spins so identical results still animate.
 */
export function Dice({
  values,
  rollSeq,
}: {
  values: [number, number]
  rollSeq: number
}) {
  const reduce = usePrefersReducedMotion()
  return (
    <div className="flex gap-3" style={{ perspective: 600 }}>
      {values.map((value, i) => (
        <Die
          key={i}
          value={value}
          spins={reduce ? 0 : rollSeq}
          delay={i * 0.06}
          reduce={reduce}
        />
      ))}
    </div>
  )
}
