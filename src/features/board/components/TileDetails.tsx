import {
  boardOf,
  countOwnedOfType,
  hasMonopoly,
  mortgageValue,
  RAILROAD_RENT,
  rentFor,
  rentMultiplier,
  UTILITY_MULTIPLIER,
  type GameState,
} from "@/core/game-core"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import { useT } from "@/core/i18n"

import { GROUP_COLOR } from "@/core/board"

function Row({
  label,
  value,
  active = false,
}: {
  label: string
  value: string
  /** Highlight the row that applies right now (current rent level). */
  active?: boolean
}) {
  return (
    <div
      className={
        "flex items-center justify-between gap-4 border-b py-1 text-sm last:border-0" +
        (active ? " -mx-2 rounded bg-primary/10 px-2 font-semibold" : "")
      }
    >
      <span className={active ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
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
  const def = tileId === null ? null : boardOf(state)[tileId]
  const tile = tileId === null ? null : state.tiles[tileId]
  const owner =
    tileId !== null && state.tiles[tileId]?.ownerId
      ? state.players.find((p) => p.id === state.tiles[tileId].ownerId)
      : undefined

  // What a visitor would actually owe right now (issue: the card used to show
  // only the base table). Utilities depend on the dice, so they show ×N.
  const houses = tile?.houses ?? 0
  const monopoly =
    def?.type === "street" && owner && hasMonopoly(state, owner.id, def.group)
  // A live boom day doubles what's actually charged — surface it here too.
  const surge = rentMultiplier(state)
  const rentNow =
    def && tileId !== null && owner && !tile?.mortgaged
      ? rentFor(state, tileId, 0) * surge
      : null
  const surgeTag = surge > 1 ? ` (📈×${surge})` : ""
  const utilityMult =
    def?.type === "utility" && owner
      ? UTILITY_MULTIPLIER[
          Math.min(countOwnedOfType(state, owner.id, "utility"), 2) - 1
        ]
      : null
  const railroadsOwned =
    def?.type === "railroad" && owner
      ? countOwnedOfType(state, owner.id, "railroad")
      : 0

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

              {owner && tile?.mortgaged && (
                <Row label={t("details.rentNow")} value={t("details.noRent")} />
              )}
              {def.type === "street" && rentNow !== null && (
                <Row
                  active
                  label={t("details.rentNow")}
                  value={`$${rentNow}${surgeTag}`}
                />
              )}
              {def.type === "railroad" && rentNow !== null && (
                <Row
                  active
                  label={t("details.rentNow")}
                  value={`$${rentNow}${surgeTag}`}
                />
              )}
              {def.type === "utility" && utilityMult && !tile?.mortgaged && (
                <Row
                  active
                  label={t("details.rentNow")}
                  value={
                    t("details.timesDice", { x: utilityMult * surge }) +
                    surgeTag
                  }
                />
              )}

              {def.type === "street" && (
                <>
                  <Row label={t("details.price")} value={`$${def.price}`} />
                  <Row
                    active={!!owner && !monopoly && houses === 0}
                    label={t("details.baseRent")}
                    value={`$${def.rent[0]}`}
                  />
                  <Row
                    active={!!monopoly && houses === 0}
                    label={t("details.withSet")}
                    value={`$${def.rent[0] * 2}`}
                  />
                  {[1, 2, 3, 4].map((n) => (
                    <Row
                      key={n}
                      active={houses === n}
                      label={t("details.house", { n })}
                      value={`$${def.rent[n]}`}
                    />
                  ))}
                  <Row
                    active={houses === 5}
                    label={t("details.hotel")}
                    value={`$${def.rent[5]}`}
                  />
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
                      active={railroadsOwned === i + 1}
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
                  value={`$${mortgageValue(state, def.id)}`}
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
