import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CircleHelp, Gift } from "lucide-react"

import { CHANCE, COMMUNITY_CHEST, type DrawnCard, type GameState } from "@/game"
import { useT } from "@/i18n"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

import { positionsOf, travelPlan } from "./board-meta"

type Deck = DrawnCard["deck"]

type Reveal = {
  /** Bumped per draw so overlapping draws restart cleanly. */
  run: number
  deck: Deck
  /** Card id currently shown on the face (cycles while spinning). */
  faceId: string
  /** Bumped on every face change to re-trigger the flip animation. */
  tick: number
  settled: boolean
}

const SPINS = 16

/** Ease-out gap schedule: quick flicks at first, slowing toward the stop. */
function gapFor(i: number): number {
  const p = i / SPINS
  return 45 + p * p * 245
}

function pickFace(deck: Deck, avoid: string): string {
  const cards = deck === "chance" ? CHANCE : COMMUNITY_CHEST
  for (let tries = 0; tries < 6; tries++) {
    const id = cards[Math.floor(Math.random() * cards.length)].id
    if (id !== avoid) return id
  }
  return cards[0].id
}

/**
 * Dramatic "slot machine" reveal for a drawn Chance / Community Chest card:
 * the face rattles through several random effects before landing on the real
 * one. Driven purely off `state.lastCard`, so it fires the same in hot-seat and
 * online. Respects reduced motion (jumps straight to the result).
 */
export function CardReveal({ state }: { state: GameState }) {
  const t = useT()
  const reduce = usePrefersReducedMotion()
  const [reveal, setReveal] = useState<Reveal | null>(null)

  const seen = useRef<DrawnCard | null>(null)
  const runId = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevPositions = useRef<Map<string, number> | null>(null)
  // Pending timers must survive unrelated state updates (they'd otherwise be
  // cancelled by any action landing mid-reveal), so clear on unmount only;
  // a genuinely new draw clears them explicitly below.
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    // The update that draws a card is the same one that moves the player onto
    // the tile — hold the reveal until the token actually lands there. For a
    // movement card that carries the token onward, this is the stop-over on
    // the deck tile, not the final destination.
    const delay = reduce
      ? 0
      : travelPlan(prevPositions.current, state).cardRevealMs
    prevPositions.current = positionsOf(state.players)

    // Only react to a genuinely new draw (identity + id both change per draw).
    const lastCard = state.lastCard
    const prev = seen.current
    seen.current = lastCard
    if (!lastCard) {
      if (!prev) return
      // Turn ended: clear any lingering reveal.
      setReveal(null)
      return
    }
    if (
      prev &&
      prev.deck === lastCard.deck &&
      prev.cardId === lastCard.cardId
    ) {
      return
    }

    for (const tm of timers.current) clearTimeout(tm)
    timers.current = []
    const run = ++runId.current
    const { deck, cardId } = lastCard

    if (reduce) {
      setReveal({ run, deck, faceId: cardId, tick: 0, settled: true })
      timers.current.push(
        setTimeout(() => {
          setReveal((r) => (r?.run === run ? null : r))
        }, 2200)
      )
      return
    }

    const start = () => {
      if (runId.current !== run) return
      let face = pickFace(deck, cardId)
      setReveal({ run, deck, faceId: face, tick: 0, settled: false })

      const step = (i: number) => {
        if (i >= SPINS) {
          setReveal({ run, deck, faceId: cardId, tick: i, settled: true })
          timers.current.push(
            setTimeout(() => {
              setReveal((r) => (r?.run === run ? null : r))
            }, 1900)
          )
          return
        }
        face = i === SPINS - 1 ? cardId : pickFace(deck, face)
        setReveal({
          run,
          deck,
          faceId: face,
          tick: i,
          settled: i === SPINS - 1,
        })
        timers.current.push(setTimeout(() => step(i + 1), gapFor(i)))
      }
      timers.current.push(setTimeout(() => step(0), gapFor(0)))
    }
    timers.current.push(setTimeout(start, delay))
  }, [state, reduce])

  const isChance = reveal?.deck === "chance"
  const accent = isChance ? "#f59e0b" : "#2563eb"
  const Icon = isChance ? CircleHelp : Gift

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ perspective: 1200 }}
    >
      <AnimatePresence>
        {reveal && (
          <motion.div
            key={reveal.run}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, rotateY: -100, scale: 0.92 }
            }
            animate={{ opacity: 1, rotateY: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={
              reduce
                ? { duration: 0.2 }
                : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
            }
            className="relative w-[min(88vw,300px)] rounded-2xl border-2 bg-card p-5 text-center shadow-2xl"
            style={{
              borderColor: accent,
              boxShadow: reveal.settled
                ? `0 0 0 3px ${accent}55, 0 18px 45px -12px ${accent}aa`
                : `0 12px 35px -12px ${accent}80`,
            }}
          >
            <motion.div
              animate={
                reveal.settled
                  ? { scale: [1, 1.18, 1] }
                  : { rotate: [0, -6, 6, 0] }
              }
              transition={
                reveal.settled
                  ? { duration: 0.4, ease: "easeOut" }
                  : { duration: 0.3, repeat: Infinity, ease: "easeInOut" }
              }
              className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accent}22` }}
            >
              <Icon className="size-7" style={{ color: accent }} />
            </motion.div>

            <div
              className="text-xs font-bold tracking-wide uppercase"
              style={{ color: accent }}
            >
              {isChance ? t("card.chance") : t("card.chest")}
            </div>

            <motion.p
              key={reveal.tick}
              initial={reveal.settled ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reveal.settled ? 0.25 : 0.08 }}
              className={
                "mt-1.5 min-h-[2.75rem] text-sm font-medium " +
                (reveal.settled ? "" : "opacity-70 blur-[0.6px]")
              }
            >
              {t(`card.${reveal.faceId}`)}
            </motion.p>

            {/* Shine sweep across the card face once the result settles. */}
            {reveal.settled && !reduce && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                <motion.div
                  className="absolute inset-y-[-30%] w-[38%] bg-white/25 blur-md"
                  style={{ rotate: 14 }}
                  initial={{ x: "-180%" }}
                  animate={{ x: "440%" }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.05 }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
