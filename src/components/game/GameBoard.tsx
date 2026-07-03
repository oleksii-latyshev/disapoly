import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { Hotel, House } from "lucide-react"

import {
  BOARD,
  currentPlayer,
  hasMonopoly,
  type GameState,
  type TileDefinition,
} from "@/game"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

import type { ReactionEvent } from "@/hooks/useRoom"

import { useBoardTheme } from "./board-theme"
import { tileCell } from "./board-meta"
import { BoardTilt } from "./BoardTilt"
import { Dice } from "./Dice"
import { EventAnnouncer } from "./EventAnnouncer"
import { ReactionLayer } from "./ReactionLayer"
import { TileDetails } from "./TileDetails"
import { TokenLayer } from "./TokenLayer"
import { isCornerTile, tileVisual } from "./tile-visuals"

/** Short label for a tile abbreviation shown when space is tight. */
function shortName(name: string): string {
  return name
    .replace(/ (Avenue|Place|Railroad|Gardens|Company|Works)$/i, "")
    .trim()
}

function priceLabel(def: TileDefinition): string | undefined {
  if ("price" in def) return `$${def.price}`
  if (def.type === "tax") return `$${def.amount}`
  return undefined
}

function Tile({
  id,
  state,
  isCurrent,
  onSelect,
}: {
  id: number
  state: GameState
  isCurrent: boolean
  onSelect: (id: number) => void
}) {
  const { theme } = useBoardTheme()
  const reduce = usePrefersReducedMotion()
  const def = BOARD[id]
  const cell = tileCell(id)
  const tile = state.tiles[id]

  // Detect a build (houses went up) — drives the construction dust puff; the
  // badge itself re-drops on any level change via its key.
  const [lastHouses, setLastHouses] = useState(tile.houses)
  const [built, setBuilt] = useState(false)
  if (tile.houses !== lastHouses) {
    setLastHouses(tile.houses)
    setBuilt(tile.houses > lastHouses)
  }
  const owner = tile.ownerId
    ? state.players.find((p) => p.id === tile.ownerId)
    : undefined

  const visual = tileVisual(def)
  const corner = isCornerTile(id)
  const groupColor =
    def.type === "street" ? theme.groupColors[def.group] : undefined
  const isMono = theme.id === "mono"
  const iconColor = isMono ? "var(--tile-fg)" : visual?.color
  const label = priceLabel(def)
  const inMonopoly =
    def.type === "street" && !!owner && hasMonopoly(state, owner.id, def.group)

  // Background: street tint, corner accent tint, or plain tile color.
  let bg = "var(--tile-bg)"
  if (def.type === "street" && theme.tintTiles && groupColor) {
    bg = `color-mix(in srgb, ${groupColor} 14%, var(--tile-bg))`
  } else if (corner && visual && !isMono) {
    bg = `color-mix(in srgb, ${visual.color} 12%, var(--tile-bg))`
  }

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
        "relative flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-md border text-[length:max(8px,1.15cqw)] leading-tight",
        "transition-[translate,box-shadow] duration-150 hover:z-10 hover:-translate-y-px hover:shadow-md",
        isCurrent && "tile-current z-10 ring-2 ring-ring"
      )}
    >
      {def.type === "street" && groupColor && (
        <div
          className="h-[max(7px,1.1cqw)] w-full shrink-0"
          style={{
            backgroundColor: groupColor,
            boxShadow: theme.glow ? `0 0 6px ${groupColor}` : undefined,
          }}
        />
      )}

      {/* Houses / hotel — a clear badge over the color band. Each new level
          drops in with a spring bounce and kicks up a puff of dust. */}
      {def.type === "street" && tile.houses > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(5px,0.7cqw)] z-10 flex justify-center">
          {built && !reduce && (
            <motion.span
              key={`dust-${tile.houses}`}
              className={cn(
                "absolute top-0 h-[max(12px,1.6cqw)] w-[max(24px,3.2cqw)] rounded-full blur-[3px]",
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

      <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-center">
        {visual && (
          <visual.Icon
            className={
              corner ? "size-[max(18px,2.4cqw)]" : "size-[max(13px,1.7cqw)]"
            }
            style={{ color: iconColor }}
            strokeWidth={2}
          />
        )}
        <span
          className={cn(
            "line-clamp-2 leading-tight",
            corner
              ? "text-[length:max(7px,1cqw)] font-bold tracking-wide"
              : "font-semibold"
          )}
        >
          {corner && visual?.label ? visual.label : shortName(def.name)}
        </span>
        {label && (
          <span className="text-[length:max(9px,1.35cqw)] font-bold opacity-85">
            {label}
          </span>
        )}
      </div>

      {owner && (
        <div
          className="owner-strip h-[max(5px,0.8cqw)] w-full shrink-0"
          style={{ backgroundColor: owner.color }}
          title={`Owned by ${owner.nickname}`}
        />
      )}
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

export function GameBoard({
  state,
  reactions,
}: {
  state: GameState
  /** Live emoji reactions to float over tokens (online play only). */
  reactions?: ReactionEvent[]
}) {
  const { theme } = useBoardTheme()
  const t = useT()
  const active = state.status === "playing" ? currentPlayer(state) : undefined
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
          <div className="@container relative grid aspect-square w-full grid-cols-11 grid-rows-11 gap-[3px]">
            {BOARD.map((def) => (
              <Tile
                key={def.id}
                id={def.id}
                state={state}
                isCurrent={def.id === currentId}
                onSelect={setSelected}
              />
            ))}

            {/* Center area */}
            <div className="col-start-2 col-end-11 row-start-2 row-end-11 flex flex-col items-center justify-center gap-4">
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
            </div>

            <TokenLayer state={state} />
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
