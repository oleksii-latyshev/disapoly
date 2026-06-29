import { BOARD, type GameState, type Player } from "@/game"
import { cn } from "@/lib/utils"

import { GROUP_COLOR, tileCell } from "./board-meta"

/** Short label for a tile abbreviation shown when space is tight. */
function shortName(name: string): string {
  return name
    .replace(/ (Avenue|Place|Railroad|Gardens|Company|Works)$/i, "")
    .trim()
}

function Tokens({ players }: { players: Player[] }) {
  if (players.length === 0) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0.5 flex flex-wrap justify-center gap-0.5">
      {players.map((p) => (
        <span
          key={p.id}
          title={p.nickname}
          className="size-2 rounded-full border border-white/70 shadow"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  )
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
  const def = BOARD[id]
  const cell = tileCell(id)
  const tile = state.tiles[id]
  const owner = tile.ownerId
    ? state.players.find((p) => p.id === tile.ownerId)
    : undefined
  const here = state.players.filter((p) => !p.isBankrupt && p.position === id)

  const groupColor = def.type === "street" ? GROUP_COLOR[def.group] : undefined
  const price = "price" in def ? def.price : undefined

  return (
    <div
      style={{ gridRow: cell.row, gridColumn: cell.col }}
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-sm border bg-card text-[8px] leading-tight",
        isCurrent && "ring-2 ring-primary"
      )}
    >
      {groupColor && (
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: groupColor }} />
      )}
      <div className="flex flex-1 flex-col items-center justify-center px-0.5 text-center">
        <span className="line-clamp-2 font-medium">{shortName(def.name)}</span>
        {price !== undefined && (
          <span className="text-muted-foreground">${price}</span>
        )}
      </div>
      {owner && (
        <div
          className="h-1 w-full shrink-0"
          style={{ backgroundColor: owner.color }}
          title={`Owned by ${owner.nickname}`}
        />
      )}
      <Tokens players={here} />
    </div>
  )
}

export function GameBoard({ state }: { state: GameState }) {
  const currentId = state.players[state.currentPlayerIndex]?.position

  return (
    <div className="aspect-square w-full max-w-[640px]">
      <div className="grid h-full w-full grid-cols-11 grid-rows-11 gap-0.5">
        {BOARD.map((def) => (
          <Tile
            key={def.id}
            id={def.id}
            state={state}
            isCurrent={def.id === currentId}
          />
        ))}
        {/* Center area */}
        <div className="col-start-2 col-end-11 row-start-2 row-end-11 flex flex-col items-center justify-center gap-1">
          <span className="text-2xl font-bold tracking-widest text-muted-foreground/60 select-none">
            DISAPOLY
          </span>
          {state.dice && (
            <div className="flex gap-2">
              {state.dice.map((face, i) => (
                <span
                  key={i}
                  className="flex size-9 items-center justify-center rounded-md border bg-card text-lg font-bold shadow-sm"
                >
                  {face}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
