import { useEffect, useRef, useState } from "react"
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

import type { ReactionEvent } from "@/hooks/useRoom"

import { useBoardTheme } from "./board-theme"
import { tileCell } from "./board-meta"
import { Dice } from "./Dice"
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
        "relative flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-md border leading-tight text-[length:max(8px,1.15cqw)]",
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

      {/* Houses / hotel — a clear badge over the color band. */}
      {def.type === "street" && tile.houses > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(5px,0.7cqw)] z-10 flex justify-center">
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-1 py-px font-bold text-white shadow text-[length:max(7px,0.95cqw)]",
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
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-center">
        {visual && (
          <visual.Icon
            className={corner ? "size-[max(18px,2.4cqw)]" : "size-[max(13px,1.7cqw)]"}
            style={{ color: iconColor }}
            strokeWidth={2}
          />
        )}
        <span
          className={cn(
            "line-clamp-2 leading-tight",
            corner
              ? "font-bold tracking-wide text-[length:max(7px,1cqw)]"
              : "font-semibold"
          )}
        >
          {corner && visual?.label ? visual.label : shortName(def.name)}
        </span>
        {label && (
          <span className="font-bold opacity-85 text-[length:max(9px,1.35cqw)]">
            {label}
          </span>
        )}
      </div>

      {owner && (
        <div
          className="h-[max(5px,0.8cqw)] w-full shrink-0"
          style={{ backgroundColor: owner.color }}
          title={`Owned by ${owner.nickname}`}
        />
      )}
      {tile.mortgaged && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-grayscale">
          <span className="rounded bg-background/70 px-1 font-bold tracking-wide text-muted-foreground text-[length:max(7px,0.9cqw)]">
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
    <div
      style={{
        ...theme.vars,
        background:
          "linear-gradient(145deg, color-mix(in srgb, var(--board-frame) 86%, white), var(--board-frame))",
      }}
      className="mx-auto w-full max-w-[min(96vw,900px)] rounded-3xl p-2 shadow-xl ring-1 ring-black/5 sm:p-3 lg:mx-0 lg:w-[min(90svh,1180px)] lg:max-w-none"
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
                className="font-black tracking-[0.32em] text-[length:max(18px,3.6cqw)]"
                style={{ color: "var(--center-fg)", opacity: 0.55 }}
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
                className="flex items-center gap-2 rounded-full border px-3 py-1 font-semibold shadow-sm text-[length:max(11px,1.3cqw)]"
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
        </div>
      </div>

      <TileDetails
        tileId={selected}
        state={state}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
