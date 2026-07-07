import { Trophy } from "lucide-react"
import { lazy, Suspense } from "react"
import { type GameState, netWorth } from "@/core/game-core"
import { useT } from "@/core/i18n"
import { Button } from "@/shared/components/ui/button"
import { cn } from "@/shared/lib/utils"

const NetWorthChart = lazy(() => import("./NetWorthChart"))

/** Full-screen results overlay shown when the game finishes. */
export function GameResults({
  state,
  onNewGame,
  canReset = true,
}: {
  state: GameState
  onNewGame: () => void
  canReset?: boolean
}) {
  const t = useT()
  if (state.status !== "finished") return null

  const winner = state.players.find((p) => p.id === state.winnerId)
  const ranked = [...state.players].sort(
    (a, b) => netWorth(state, b.id) - netWorth(state, a.id)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90svh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl">
        <div className="flex flex-col items-center gap-1 text-center">
          <Trophy className="size-8 text-amber-400" />
          <h2 className="font-bold text-lg">
            {winner
              ? t("turn.wins", { name: winner.nickname })
              : t("turn.gameOver")}
          </h2>
        </div>

        <div>
          <div className="mb-1 font-medium text-muted-foreground text-xs">
            {t("results.standings")}
          </div>
          <div className="flex flex-col gap-1">
            {ranked.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm",
                  p.id === state.winnerId && "ring-2 ring-amber-400"
                )}
              >
                <span className="w-4 text-center font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {p.nickname}
                  {p.isBankrupt && (
                    <span className="ml-1 text-destructive text-xs">
                      ({t("results.bankrupt")})
                    </span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">
                  ${netWorth(state, p.id)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Suspense fallback={<div className="h-[200px]" />}>
          <NetWorthChart state={state} height={200} />
        </Suspense>

        {canReset ? (
          <Button onClick={onNewGame}>{t("turn.newGame")}</Button>
        ) : (
          <p className="text-center text-muted-foreground text-xs">
            {t("turn.waitHostNew")}
          </p>
        )}
      </div>
    </div>
  )
}
