import { Hotel, House, Landmark } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  boardOf,
  canBuildHouse,
  canMortgage,
  canSellHouse,
  canUnmortgage,
  currentPlayer,
  ownedTiles,
  unmortgageCost,
  type GameAction,
  type GameState,
} from "@/modules/game-core"
import { useT } from "@/modules/i18n"

import { GROUP_COLOR } from "@/modules/board"

/**
 * Property management for the player whose turn it is. Build/sell houses,
 * mortgage/unmortgage. Shown only during the manage phases (before rolling or
 * before ending the turn) and, online, only to the active player.
 */
export function ManagePanel({
  state,
  send,
  localPlayerId,
}: {
  state: GameState
  send: (action: GameAction) => void
  localPlayerId?: string
}) {
  const t = useT()
  if (state.status !== "playing") return null

  const player = currentPlayer(state)
  if (localPlayerId !== undefined && player.id !== localPlayerId) return null

  const canManage =
    state.phase === "awaiting-roll" || state.phase === "awaiting-end"
  if (!canManage) return null

  const tiles = ownedTiles(state, player.id)

  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("manage.title")}
        </span>
        <span
          className="text-[11px] text-muted-foreground tabular-nums"
          title={t("manage.supplyTitle")}
        >
          🏠 {state.bank.houses} · 🏨 {state.bank.hotels}
        </span>
      </div>

      {tiles.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("manage.empty")}</p>
      )}

      <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
        {tiles.map((id) => {
          const def = boardOf(state)[id]
          const tile = state.tiles[id]
          const groupColor =
            def.type === "street" ? GROUP_COLOR[def.group] : undefined

          return (
            <div
              key={id}
              className="flex items-center gap-1.5 rounded border px-1.5 py-1 text-xs"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: groupColor ?? "var(--muted-foreground)",
                }}
              />
              <span className="min-w-0 flex-1 truncate">
                {def.name}
                {tile.mortgaged && (
                  <span className="ml-1 text-muted-foreground">
                    {t("manage.mortgaged")}
                  </span>
                )}
                {def.type === "street" && tile.houses > 0 && (
                  <span className="ml-1 text-muted-foreground">
                    {tile.houses === 5 ? "🏨" : "🏠".repeat(tile.houses)}
                  </span>
                )}
              </span>

              {def.type === "street" && (
                <>
                  <Button
                    size="icon-xs"
                    variant="outline"
                    disabled={!canBuildHouse(state, player.id, id)}
                    title={t("manage.build", { cost: def.houseCost })}
                    onClick={() => send({ type: "BUILD_HOUSE", tileId: id })}
                  >
                    {tile.houses === 4 ? <Hotel /> : <House />}
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    disabled={!canSellHouse(state, player.id, id)}
                    title={t("manage.sell")}
                    onClick={() => send({ type: "SELL_HOUSE", tileId: id })}
                  >
                    −
                  </Button>
                </>
              )}

              {tile.mortgaged ? (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!canUnmortgage(state, player.id, id)}
                  title={t("manage.liftMortgage", {
                    cost: unmortgageCost(state, id),
                  })}
                  onClick={() => send({ type: "UNMORTGAGE", tileId: id })}
                >
                  {t("manage.unmortgage")}
                </Button>
              ) : (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={!canMortgage(state, player.id, id)}
                  title={t("manage.mortgage")}
                  onClick={() => send({ type: "MORTGAGE", tileId: id })}
                >
                  <Landmark />
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
