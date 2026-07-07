import { HelpCircle } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog"
import { GO_PAYOUT, JAIL_FINE, STARTING_BALANCE } from "@/core/game-core"
import { useT } from "@/core/i18n"

const SECTIONS = [
  "goal",
  "turn",
  "buy",
  "build",
  "mortgage",
  "jail",
  "cards",
  "trade",
  "win",
] as const

/** Fixed bottom-left "?" button → a concise, localized rules reference. */
export function HowToPlayButton() {
  const t = useT()
  const nums = { start: STARTING_BALANCE, go: GO_PAYOUT, fine: JAIL_FINE }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={t("howto.title")}
            className="fixed bottom-4 left-16 z-50 rounded-full shadow-md"
          />
        }
      >
        <HelpCircle />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("howto.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[70svh] flex-col gap-3 overflow-y-auto pr-1 text-sm">
          {SECTIONS.map((s) => (
            <div key={s}>
              <div className="font-semibold">{t(`howto.${s}.title`)}</div>
              <p className="text-muted-foreground">
                {t(`howto.${s}.body`, nums)}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
