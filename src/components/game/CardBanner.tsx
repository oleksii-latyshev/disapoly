import { CircleHelp, Gift } from "lucide-react"

import type { DrawnCard } from "@/game"
import { useT } from "@/i18n"

/** Shows the card the current player just drew (until the turn ends). */
export function CardBanner({ card }: { card: DrawnCard }) {
  const t = useT()
  const isChance = card.deck === "chance"
  const Icon = isChance ? CircleHelp : Gift
  const accent = isChance ? "#f59e0b" : "#2563eb"

  return (
    <div
      className="flex items-start gap-2.5 rounded-md border-l-4 bg-card p-3 shadow-sm"
      style={{ borderLeftColor: accent }}
    >
      <Icon className="mt-0.5 size-5 shrink-0" style={{ color: accent }} />
      <div className="min-w-0">
        <div className="text-xs font-semibold" style={{ color: accent }}>
          {isChance ? t("card.chance") : t("card.chest")}
        </div>
        <p className="text-sm">{t(`card.${card.cardId}`)}</p>
      </div>
    </div>
  )
}
