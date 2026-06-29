import { useEffect, useRef, useState } from "react"

import { BOARD, type GameState, type TileDefinition } from "@/game"
import { cn } from "@/lib/utils"

import { useBoardTheme } from "./board-theme"
import { tileCell } from "./board-meta"
import { Dice } from "./Dice"
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
}: {
  id: number
  state: GameState
  isCurrent: boolean
}) {
  const { theme } = useBoardTheme()
  const def = BOARD[id]
  const cell = tileCell(id)
  const tile = state.tiles[id]
  const owner = tile.ownerId
    ? state.players.find((p) => p.id === tile.ownerId)
    : undefined

  const visual = tileVisual(def)
  const corner = isCornerTile(id)
  const groupColor = def.type === "street" ? theme.groupColors[def.group] : undefined
  const isMono = theme.id === "mono"
  const iconColor = isMono ? "var(--tile-fg)" : visual?.color
  const label = priceLabel(def)

  // Background: street tint, corner accent tint, or plain tile color.
  let bg = "var(--tile-bg)"
  if (def.type === "street" && theme.tintTiles && groupColor) {
    bg = `color-mix(in srgb, ${groupColor} 14%, var(--tile-bg))`
  } else if (corner && visual && !isMono) {
    bg = `color-mix(in srgb, ${visual.color} 12%, var(--tile-bg))`
  }

  return (
    <div
      style={{
        gridRow: cell.row,
        gridColumn: cell.col,
        backgroundColor: bg,
        borderColor: "var(--tile-border)",
        color: "var(--tile-fg)",
        translate: "0 0",
      }}
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-md border text-[8px] leading-tight",
        "transition-[translate,box-shadow] duration-150 hover:z-10 hover:-translate-y-px hover:shadow-md",
        isCurrent && "tile-current z-10 ring-2 ring-ring"
      )}
    >
      {/* Street: color band + optional house markers */}
      {def.type === "street" && groupColor && (
        <div
          className="h-2 w-full shrink-0"
          style={{
            backgroundColor: groupColor,
            boxShadow: theme.glow ? `0 0 6px ${groupColor}` : undefined,
          }}
        />
      )}
      {def.type === "street" && tile.houses > 0 && (
        <div className="absolute inset-x-0 top-2 flex justify-center gap-px">
          {tile.houses === 5 ? (
            <span className="h-1.5 w-3 rounded-[1px] bg-red-600 shadow" title="Hotel" />
          ) : (
            Array.from({ length: tile.houses }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1 rounded-[1px] bg-emerald-500 shadow-sm"
              />
            ))
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-center">
        {visual && (
          <visual.Icon
            className={corner ? "size-5" : "size-3.5"}
            style={{ color: iconColor }}
            strokeWidth={2}
          />
        )}
        <span
          className={cn(
            "line-clamp-2 leading-tight",
            corner ? "text-[7px] font-bold tracking-wide" : "font-medium"
          )}
        >
          {corner && visual?.label ? visual.label : shortName(def.name)}
        </span>
        {label && <span className="opacity-55">{label}</span>}
      </div>

      {owner && (
        <div
          className="h-1.5 w-full shrink-0"
          style={{ backgroundColor: owner.color }}
          title={`Owned by ${owner.nickname}`}
        />
      )}
      {tile.mortgaged && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-grayscale">
          <span className="rounded bg-background/70 px-1 text-[7px] font-bold tracking-wide text-muted-foreground">
            MTG
          </span>
        </div>
      )}
    </div>
  )
}

export function GameBoard({ state }: { state: GameState }) {
  const { theme } = useBoardTheme()
  const currentId = state.players[state.currentPlayerIndex]?.position

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
    <div
      style={{
        ...theme.vars,
        background:
          "linear-gradient(145deg, color-mix(in srgb, var(--board-frame) 86%, white), var(--board-frame))",
      }}
      className="w-full max-w-[780px] rounded-3xl p-2.5 shadow-xl ring-1 ring-black/5 sm:p-3.5"
    >
      <div
        className="relative overflow-hidden rounded-2xl p-1 shadow-inner"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--board-inner) 94%, white), var(--board-inner))",
        }}
      >
        <div className="relative grid aspect-square w-full grid-cols-11 grid-rows-11 gap-[3px]">
          {BOARD.map((def) => (
            <Tile
              key={def.id}
              id={def.id}
              state={state}
              isCurrent={def.id === currentId}
            />
          ))}

          {/* Center area */}
          <div className="col-start-2 col-end-11 row-start-2 row-end-11 flex flex-col items-center justify-center gap-3">
            <div className="flex flex-col items-center gap-1.5 select-none">
              <span
                className="text-3xl font-black tracking-[0.32em] sm:text-4xl"
                style={{ color: "var(--center-fg)", opacity: 0.55 }}
              >
                DISAPOLY
              </span>
              <span
                className="h-px w-28 rounded-full"
                style={{ background: "var(--center-fg)", opacity: 0.25 }}
              />
            </div>
            {state.dice && <Dice values={state.dice} rollSeq={rollSeq} />}
          </div>

          <TokenLayer state={state} />
        </div>
      </div>
    </div>
  )
}
