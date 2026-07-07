import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"
import { type CSSProperties, type ReactNode, useCallback } from "react"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import { cn } from "@/shared/lib/utils"

/** Max tilt in degrees — enough for depth, small enough to stay readable. */
const MAX_TILT = 3.2

const SPRING = { stiffness: 120, damping: 18, mass: 0.5 }

/**
 * Perspective wrapper that tilts the board a few degrees toward the mouse,
 * with a soft drop shadow that shifts against the tilt so the board reads as
 * a physical object. Mouse-only (touch never tilts) and inert under
 * prefers-reduced-motion (falls back to a static shadow).
 */
export function BoardTilt({
  className,
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const reduce = usePrefersReducedMotion()

  // Pointer position over the board, normalized to 0..1.
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(
    useTransform(py, [0, 1], [MAX_TILT, -MAX_TILT]),
    SPRING
  )
  const rotateY = useSpring(
    useTransform(px, [0, 1], [-MAX_TILT, MAX_TILT]),
    SPRING
  )
  // Shadow slides opposite the tilt, as if lit from straight above.
  const shadowX = useTransform(rotateY, (v) => v * -2.4)
  const shadowY = useTransform(rotateX, (v) => v * 2.4 + 16)
  const boxShadow = useMotionTemplate`${shadowX}px ${shadowY}px 36px -12px rgba(0, 0, 0, 0.35), 0 4px 16px -8px rgba(0, 0, 0, 0.25)`

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse") return
      const rect = e.currentTarget.getBoundingClientRect()
      px.set((e.clientX - rect.left) / rect.width)
      py.set((e.clientY - rect.top) / rect.height)
    },
    [px, py]
  )

  const reset = useCallback(() => {
    px.set(0.5)
    py.set(0.5)
  }, [px, py])

  if (reduce) {
    return (
      <div className={cn(className, "shadow-xl")} style={style}>
        {children}
      </div>
    )
  }

  return (
    <div style={{ perspective: 1500 }}>
      <motion.div
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        className={className}
        style={{ ...style, rotateX, rotateY, boxShadow }}
      >
        {children}
      </motion.div>
    </div>
  )
}
