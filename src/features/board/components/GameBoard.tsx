import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { Hotel, House } from "lucide-react"

import {
  activeEvent,
  boardOf,
  boardSizeOf,
  currentPlayer,
  hasMonopoly,
  rentFor,
  rentMultiplier,
  UTILITY_MULTIPLIER,
  countOwnedOfType,
  type BoardEvent,
  type GameState,
  type TileDefinition,
} from "@/modules/game-core"
import { cn } from "@/lib/utils"
import { useT } from "@/modules/i18n"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

import type { ReactionEvent } from "@/modules/network"

import { useBoardTheme } from "./board-theme"
import { EVENT_EMOJI, gridSide, tileCell, tileCenter } from "@/modules/board"
import { BoardTilt } from "./BoardTilt"
import { Dice } from "./Dice"
import { EventAnnouncer } from "@/features/events"
import { EventFxLayer, useEventFx } from "@/features/events"
import { ReactionLayer } from "./ReactionLayer"
import { TileDetails } from "./TileDetails"
import { TokenLayer } from "./TokenLayer"
import { contrastText, isCornerTile, tileVisual } from "./tile-visuals"

/** Short label for a tile abbreviation shown when space is tight. */
function shortName(name: string): string {
  return name
    .replace(/ (Avenue|Place|Railroad|Gardens|Company|Works)$/i, "")
    .trim()
}

/**
 * Which board edge a tile sits on. Drives the band/strip placement: the group
 * color always faces *outward*, the owner/value strip faces the board center.
 */
type Side = "bottom" | "left" | "top" | "right" | "corner"

function tileSide(id: number, size: number): Side {
  const quarter = size / 4
  if (isCornerTile(id, size)) return "corner"
  if (id < quarter) return "bottom"
  if (id < 2 * quarter) return "left"
  if (id < 3 * quarter) return "top"
  return "right"
}

/**
 * The value strip along the tile's bottom edge: the price while the bank owns
 * it, the rent a visitor would pay once someone does (in the owner's color) —
 * so "what will this cost me?" is readable straight off the board.
 */
function stripLabel(state: GameState, def: TileDefinition): string | undefined {
  if (def.type === "tax") return `$${def.amount}`
  if (!("price" in def)) return undefined
  const tile = state.tiles[def.id]
  if (!tile.ownerId) return `$${def.price}`
  if (tile.mortgaged) return "MTG"
  // A live boom day doubles what's actually charged — show the real number.
  const surge = rentMultiplier(state)
  if (def.type === "utility") {
    const owned = countOwnedOfType(state, tile.ownerId, "utility")
    return `×${(UTILITY_MULTIPLIER[Math.min(owned, 2) - 1] ?? 0) * surge}`
  }
  return `$${rentFor(state, def.id, 0) * surge}`
}

/** Grid template for an n×n board (Tailwind only ships fixed presets). */
function gridTemplate(n: number) {
  return {
    gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`,
  }
}

/**
 * How a tile on the table of a pending trade reads to the viewer: something
 * they'd gain, something they'd give away, or (for spectators) just "in play".
 */
function tradeHighlight(
  state: GameState,
  id: number,
  localPlayerId?: string
): "gain" | "lose" | "watch" | null {
  let role: "gain" | "lose" | "watch" | null = null
  for (const offer of state.pendingTrades) {
    const inGive = offer.give.tiles.includes(id)
    const inReceive = offer.receive.tiles.includes(id)
    if (!inGive && !inReceive) continue
    // Hot-seat has no fixed viewer — read it from the responder's side.
    const viewer = localPlayerId ?? offer.toId
    if (viewer === offer.fromId || viewer === offer.toId) {
      const gains = inGive ? viewer === offer.toId : viewer === offer.fromId
      return gains ? "gain" : "lose"
    }
    role = "watch"
  }
  return role
}

function Tile({
  id,
  state,
  isCurrent,
  onSelect,
  localPlayerId,
}: {
  id: number
  state: GameState
  isCurrent: boolean
  onSelect: (id: number) => void
  localPlayerId?: string
}) {
  const { theme } = useBoardTheme()
  const reduce = usePrefersReducedMotion()
  const size = boardSizeOf(state)
  const def = boardOf(state)[id]
  const cell = tileCell(id, size)
  const tile = state.tiles[id]

  // Detect a build (houses went up) — drives the construction dust puff; the
  // badge itself re-drops on any level change via its key.
  const [lastHouses, setLastHouses] = useState(tile.houses)
  const [built, setBuilt] = useState(false)
  if (tile.houses !== lastHouses) {
    setLastHouses(tile.houses)
    setBuilt(tile.houses > lastHouses)
  }

  // A player→player ownership transfer (trade, bankruptcy to a creditor)
  // pulses the tile for a couple of seconds so the swap is easy to spot.
  const [lastOwnerId, setLastOwnerId] = useState(tile.ownerId)
  const [traded, setTraded] = useState(false)
  if (tile.ownerId !== lastOwnerId) {
    setLastOwnerId(tile.ownerId)
    if (tile.ownerId !== null && lastOwnerId !== null) setTraded(true)
  }
  useEffect(() => {
    if (!traded) return
    const timer = setTimeout(() => setTraded(false), 2200)
    return () => clearTimeout(timer)
  }, [traded])

  const owner = tile.ownerId
    ? state.players.find((p) => p.id === tile.ownerId)
    : undefined

  const visual = tileVisual(def)
  const corner = isCornerTile(id, size)
  const groupColor =
    def.type === "street" ? theme.groupColors[def.group] : undefined
  const isMono = theme.id === "mono"
  const label = stripLabel(state, def)
  const inMonopoly =
    def.type === "street" && !!owner && hasMonopoly(state, owner.id, def.group)

  // Background: the owner's color washes the whole tile once it's bought
  // (who-owns-what reads straight off the board); otherwise a street's group
  // tint or a corner accent.
  let bg = "var(--tile-bg)"
  if (owner) {
    bg = `color-mix(in srgb, ${owner.color} ${isMono ? 24 : 18}%, var(--tile-bg))`
  } else if (def.type === "street" && theme.tintTiles && groupColor) {
    bg = `color-mix(in srgb, ${groupColor} 14%, var(--tile-bg))`
  } else if (corner && visual && !isMono) {
    bg = `color-mix(in srgb, ${visual.color} 12%, var(--tile-bg))`
  }

  // Emblem badge: a filled disc in the location's signature color with the
  // icon knocked out — logo-like, so every location is unique at a glance.
  const emblemBg = isMono ? "transparent" : visual?.color
  const emblemFg = isMono
    ? "var(--tile-fg)"
    : visual
      ? contrastText(visual.color)
      : "var(--tile-fg)"

  // Group color faces outward, the owner/value strip faces the board center.
  const side = tileSide(id, size)
  const isVertical = side === "left" || side === "right"
  const bandFirst = side === "top" || side === "left"

  // While a trade offer is on the table, its tiles pulse on the board itself.
  const trade = tradeHighlight(state, id, localPlayerId)

  return (
    <div
      onClick={() => onSelect(id)}
      style={{
        gridRow: cell.row,
        gridColumn: cell.col,
        backgroundColor: bg,
        borderColor: "var(--tile-border)",
        color: "var(--tile-fg)",
        translate: "0 0",
        // Monopoly: a gold outline marks tiles whose owner can build.
        outline: inMonopoly ? "2px solid #f5a623" : undefined,
        outlineOffset: inMonopoly ? "-2px" : undefined,
      }}
      className={cn(
        "relative flex min-h-0 cursor-pointer overflow-hidden rounded-md border text-[length:max(8px,1.15cqw)] leading-tight",
        isVertical ? "flex-row" : "flex-col",
        "transition-[translate,box-shadow] duration-150 hover:z-10 hover:-translate-y-px hover:shadow-md",
        isCurrent && "tile-current z-10 ring-2 ring-ring",
        traded && !reduce && "tile-traded z-10",
        !traded && trade && `tile-trade-${trade} z-10`
      )}
    >
      {def.type === "street" && groupColor && (
        <div
          className={cn(
            "shrink-0",
            isVertical
              ? "h-full w-[max(5px,0.9cqw)]"
              : "h-[max(5px,0.9cqw)] w-full",
            bandFirst ? "order-1" : "order-3"
          )}
          style={{
            backgroundColor: groupColor,
            boxShadow: theme.glow ? `0 0 6px ${groupColor}` : undefined,
          }}
        />
      )}

      {/* Houses / hotel — a clear badge hugging the outer (color band) edge.
          Each new level drops in with a spring bounce and a puff of dust. */}
      {def.type === "street" && tile.houses > 0 && (
        <div
          className={cn(
            "pointer-events-none absolute z-10 flex",
            side === "top" && "inset-x-0 top-[max(5px,0.7cqw)] justify-center",
            side === "bottom" &&
              "inset-x-0 bottom-[max(5px,0.7cqw)] justify-center",
            side === "left" &&
              "inset-y-0 left-[max(5px,0.7cqw)] flex-col justify-center",
            side === "right" &&
              "inset-y-0 right-[max(5px,0.7cqw)] flex-col items-end justify-center"
          )}
        >
          {built && !reduce && (
            <motion.span
              key={`dust-${tile.houses}`}
              className={cn(
                "absolute inset-0 m-auto h-[max(12px,1.6cqw)] w-[max(24px,3.2cqw)] rounded-full blur-[3px]",
                tile.houses === 5 ? "bg-red-400/60" : "bg-emerald-400/60"
              )}
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
          )}
          <motion.span
            key={tile.houses}
            initial={reduce ? false : { y: -12, scale: 0.4, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 480, damping: 15, mass: 0.7 }
            }
            className={cn(
              "flex items-center gap-0.5 rounded-full px-1 py-px text-[length:max(7px,0.95cqw)] font-bold text-white shadow",
              tile.houses === 5 ? "bg-red-600" : "bg-emerald-600"
            )}
          >
            {tile.houses === 5 ? (
              <Hotel className="size-[max(8px,1.1cqw)]" />
            ) : (
              <>
                <House className="size-[max(8px,1.1cqw)]" />
                {tile.houses}
              </>
            )}
          </motion.span>
        </div>
      )}

      {/* min-w-0: long names must shrink, or they push the group band past
          the tile edge (the "neon leaking off the board" bug). */}
      <div className="order-2 flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-[max(2px,0.25cqw)] px-0.5 text-center">
        {visual && (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full",
              corner
                ? "size-[max(20px,2.9cqw)]"
                : "size-[max(16px,2.4cqw)] shadow-sm",
              isMono && "shadow-none"
            )}
            style={{
              backgroundColor: emblemBg,
              boxShadow:
                theme.glow && !isMono && visual
                  ? `0 0 8px ${visual.color}`
                  : undefined,
            }}
          >
            <visual.Icon
              className={
                corner ? "size-[max(13px,1.8cqw)]" : "size-[max(10px,1.5cqw)]"
              }
              style={{ color: emblemFg }}
              strokeWidth={2.25}
            />
          </span>
        )}
        {/* Names hide on small boards — the emblem identifies the tile and
            tapping it opens the full details. */}
        <span className={corner ? undefined : "hidden @[560px]:block"}>
          <span
            className={cn(
              "line-clamp-2 leading-[1.05]",
              corner
                ? "text-[length:max(7px,1cqw)] font-bold tracking-wide"
                : "text-[length:max(7px,1cqw)] font-semibold"
            )}
          >
            {corner && visual?.label ? visual.label : shortName(def.name)}
          </span>
        </span>
        {/* Price / current rent as a tag right under the name — always in the
            same spot regardless of which board edge the tile sits on. */}
        {label && (
          <span
            key={tile.ownerId ?? "bank"}
            className={cn(
              "max-w-full shrink-0 truncate rounded-full px-[max(4px,0.5cqw)] py-px text-[length:max(7px,1cqw)] font-bold tabular-nums",
              owner && "owner-strip"
            )}
            style={
              owner
                ? {
                    backgroundColor: owner.color,
                    color: contrastText(owner.color),
                  }
                : {
                    backgroundColor:
                      "color-mix(in srgb, var(--tile-fg) 10%, transparent)",
                    color: "var(--tile-fg)",
                  }
            }
            title={owner ? `Owned by ${owner.nickname}` : undefined}
          >
            {label}
          </span>
        )}
      </div>
      {tile.mortgaged && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-grayscale">
          <span className="rounded bg-background/70 px-1 text-[length:max(7px,0.9cqw)] font-bold tracking-wide text-muted-foreground">
            MTG
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * A bobbing emoji marker over the tile a surprise event sits on (bounty /
 * rabbit). Keyed by tile so the rabbit visibly pops to its next spot per hop.
 */
function EventMarker({ event, size }: { event: BoardEvent; size: number }) {
  const reduce = usePrefersReducedMotion()
  if (event.tileId === null) return null
  const c = tileCenter(event.tileId, size)
  return (
    <motion.div
      key={`${event.kind}-${event.tileId}`}
      className="pointer-events-none absolute z-20 text-[length:max(16px,2.8cqw)] drop-shadow-md"
      style={{ left: `${c.x}%`, top: `${c.y}%`, x: "-50%", y: "-58%" }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduce
          ? { duration: 0.2 }
          : { type: "spring", stiffness: 380, damping: 16 }
      }
    >
      <motion.span
        className="block"
        animate={reduce ? undefined : { y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}
      >
        {EVENT_EMOJI[event.kind]}
      </motion.span>
    </motion.div>
  )
}

export function GameBoard({
  state,
  reactions,
  localPlayerId,
}: {
  state: GameState
  /** Live emoji reactions to float over tokens (online play only). */
  reactions?: ReactionEvent[]
  /** Online only: whose screen this is (personalizes trade highlights). */
  localPlayerId?: string
}) {
  const { theme } = useBoardTheme()
  const t = useT()
  const board = boardOf(state)
  const n = gridSide(board.length)
  const active = state.status === "playing" ? currentPlayer(state) : undefined
  const event = activeEvent(state)
  const fx = useEventFx(state)
  // The earthquake effect is the board itself rattling (CSS keyframes; the
  // class is inert under prefers-reduced-motion like the other board effects).
  const quaking = fx.some((f) => f.kind === "earthquake")
  const currentId = state.players[state.currentPlayerIndex]?.position
  const [selected, setSelected] = useState<number | null>(null)

  // Bump a counter on every roll so the dice re-tumble even on repeat values.
  const [rollSeq, setRollSeq] = useState(0)
  const lastSeed = useRef(state.rngSeed)
  useEffect(() => {
    if (state.rngSeed !== lastSeed.current) {
      lastSeed.current = state.rngSeed
      setRollSeq((s) => s + 1)
    }
  }, [state.rngSeed])

  return (
    <div className="mx-auto w-full max-w-[min(96vw,900px)] lg:mx-0 lg:w-[min(90svh,1180px)] lg:max-w-none">
      <BoardTilt
        style={{
          ...theme.vars,
          background:
            "linear-gradient(145deg, color-mix(in srgb, var(--board-frame) 86%, white), var(--board-frame))",
        }}
        className="rounded-3xl p-2 ring-1 ring-black/5 sm:p-3"
      >
        <div
          className="relative overflow-hidden rounded-2xl p-1 shadow-inner"
          style={{
            background:
              "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--board-inner) 94%, white), var(--board-inner))",
          }}
        >
          <div
            className={cn(
              "@container relative grid aspect-square w-full gap-[3px]",
              quaking && "board-quake"
            )}
            style={gridTemplate(n)}
          >
            {board.map((def) => (
              <Tile
                key={def.id}
                id={def.id}
                state={state}
                isCurrent={def.id === currentId}
                onSelect={setSelected}
                localPlayerId={localPlayerId}
              />
            ))}

            {/* Center area */}
            <div
              className="flex flex-col items-center justify-center gap-4"
              style={{ gridColumn: `2 / ${n}`, gridRow: `2 / ${n}` }}
            >
              <div className="flex flex-col items-center gap-2 select-none">
                <span
                  className="board-logo text-[length:max(18px,3.6cqw)] font-black tracking-[0.32em]"
                  style={{ opacity: 0.6 }}
                >
                  DISAPOLY
                </span>
                <span
                  className="h-px w-[22%] rounded-full"
                  style={{ background: "var(--center-fg)", opacity: 0.25 }}
                />
              </div>
              {state.dice && <Dice values={state.dice} rollSeq={rollSeq} />}

              {active && (
                <div
                  className="flex items-center gap-2 rounded-full border px-3 py-1 text-[length:max(11px,1.3cqw)] font-semibold shadow-sm"
                  style={{
                    backgroundColor: "var(--tile-bg)",
                    color: "var(--tile-fg)",
                    borderColor: "var(--tile-border)",
                  }}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: active.color }}
                  />
                  {t("turn.turnOf", { name: active.nickname })}
                </div>
              )}

              {/* Live surprise event — a golden pill so the whole table sees
                  what's in play (and what the marker on the board means). */}
              {event && (
                <div
                  className="flex items-center gap-1.5 rounded-full border border-amber-500/50 px-3 py-1 text-[length:max(10px,1.2cqw)] font-semibold shadow-sm"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, #f5a623 16%, var(--tile-bg))",
                    color: "var(--tile-fg)",
                  }}
                >
                  <span>{EVENT_EMOJI[event.kind]}</span>
                  {t(`event.banner.${event.kind}`, { amount: event.amount })}
                </div>
              )}
            </div>

            <TokenLayer state={state} />
            {event && <EventMarker event={event} size={board.length} />}
            <EventFxLayer fx={fx} state={state} />
            {reactions && <ReactionLayer state={state} reactions={reactions} />}
            <EventAnnouncer state={state} />
          </div>
        </div>
      </BoardTilt>

      <TileDetails
        tileId={selected}
        state={state}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
