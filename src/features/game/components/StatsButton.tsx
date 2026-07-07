import { ChartLine } from "lucide-react"
import { lazy, Suspense } from "react"
import type { GameState } from "@/core/game-core"
import { useT } from "@/core/i18n"
import { Button } from "@/shared/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog"

const NetWorthChart = lazy(() => import("./NetWorthChart"))

/** Opens the net-worth chart during play. */
export function StatsButton({ state }: { state: GameState }) {
  const t = useT()
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="w-full" />}
      >
        <ChartLine /> {t("stats.open")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("stats.title")}</DialogTitle>
        </DialogHeader>
        <Suspense fallback={<div className="h-[260px]" />}>
          <NetWorthChart state={state} height={260} />
        </Suspense>
      </DialogContent>
    </Dialog>
  )
}
