import {
  BOARD,
  mortgageValue,
  RAILROAD_RENT,
  UTILITY_MULTIPLIER,
  type GameState,
} from "@/game"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useT } from "@/i18n"

import { GROUP_COLOR } from "./board-meta"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-1 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

/** Details dialog for a tile: prices and the full rent table. */
export function TileDetails({
  tileId,
  state,
  onClose,
}: {
  tileId: number | null
  state: GameState
  onClose: () => void
}) {
  const t = useT()
  const def = tileId === null ? null : BOARD[tileId]
  const owner =
    tileId !== null && state.tiles[tileId]?.ownerId
      ? state.players.find((p) => p.id === state.tiles[tileId].ownerId)
      : undefined

  return (
    <Dialog open={tileId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xs">
        {def && (
          <>
            <DialogHeader>
              {def.type === "street" && (
                <div
                  className="-mt-1 mb-1 h-2 w-full rounded-full"
                  style={{ backgroundColor: GROUP_COLOR[def.group] }}
                />
              )}
              <DialogTitle>{def.name}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col">
              {owner && (
                <Row label={t("details.owner")} value={owner.nickname} />
              )}

              {def.type === "street" && (
                <>
                  <Row label={t("details.price")} value={`$${def.price}`} />
                  <Row label={t("details.baseRent")} value={`$${def.rent[0]}`} />
                  <Row
                    label={t("details.withSet")}
                    value={`$${def.rent[0] * 2}`}
                  />
                  {[1, 2, 3, 4].map((n) => (
                    <Row
                      key={n}
                      label={t("details.house", { n })}
                      value={`$${def.rent[n]}`}
                    />
                  ))}
                  <Row label={t("details.hotel")} value={`$${def.rent[5]}`} />
                  <Row
                    label={t("details.houseCost")}
                    value={`$${def.houseCost}`}
                  />
                </>
              )}

              {def.type === "railroad" && (
                <>
                  <Row label={t("details.price")} value={`$${def.price}`} />
                  {RAILROAD_RENT.map((rent, i) => (
                    <Row
                      key={i}
                      label={t("details.owned", { n: i + 1 })}
                      value={`$${rent}`}
                    />
                  ))}
                </>
              )}

              {def.type === "utility" && (
                <>
                  <Row label={t("details.price")} value={`$${def.price}`} />
                  <Row
                    label={t("details.owned", { n: 1 })}
                    value={t("details.timesDice", { x: UTILITY_MULTIPLIER[0] })}
                  />
                  <Row
                    label={t("details.owned", { n: 2 })}
                    value={t("details.timesDice", { x: UTILITY_MULTIPLIER[1] })}
                  />
                </>
              )}

              {"price" in def && (
                <Row
                  label={t("details.mortgage")}
                  value={`$${mortgageValue(def.id)}`}
                />
              )}

              {def.type === "tax" && (
                <Row label={t("details.tax")} value={`$${def.amount}`} />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
