import { netWorth, type GameState } from "@/game"
import { cn } from "@/lib/utils"

export function PlayersList({ state }: { state: GameState }) {
  return (
    <div className="flex flex-col gap-1.5">
      {state.players.map((player, index) => {
        const isCurrent =
          index === state.currentPlayerIndex && state.status === "playing"
        return (
          <div
            key={player.id}
            className={cn(
              "flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm",
              isCurrent && "ring-2 ring-primary",
              player.isBankrupt && "opacity-50"
            )}
          >
            <span
              className="size-3 shrink-0 rounded-full border border-white/70"
              style={{ backgroundColor: player.color }}
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {player.nickname}
              {player.inJail && (
                <span className="ml-1 text-xs text-muted-foreground">(jail)</span>
              )}
              {player.isBankrupt && (
                <span className="ml-1 text-xs text-destructive">(bankrupt)</span>
              )}
            </span>
            <span className="text-right tabular-nums">
              <span className="block font-semibold">${player.balance}</span>
              <span className="block text-[10px] text-muted-foreground">
                net ${netWorth(state, player.id)}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
