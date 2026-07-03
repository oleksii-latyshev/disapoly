import { lazy, Suspense } from "react"
import { ChartLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { GameState } from "@/game"
import { useT } from "@/i18n"

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
