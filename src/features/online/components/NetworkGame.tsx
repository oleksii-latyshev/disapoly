import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { WifiOff } from "lucide-react"
import type { ClientMessage, RoomMember, RoomState } from "@/modules/game-core"
import type { ReactionEvent } from "@/modules/network"
import { useT } from "@/modules/i18n"
import { useGameSounds } from "@/features/game"
import { useTabAlert } from "@/hooks/useTabAlert"

import { AuctionPanel } from "@/features/auction"
import { CardBanner } from "@/features/game"
import { GameBoard } from "@/features/board"
import { GameEvents } from "@/features/game"
import { GameLog } from "@/features/game"
import { GameResults } from "@/features/game"
import { ManagePanel } from "@/features/game"
import { connectionQuality } from "@/modules/network"
import { PlayersList } from "@/features/game"
import { ReactionBar } from "./ReactionBar"
import { StatsButton } from "@/features/game"
import { TradePanel } from "@/features/trade"
import { TurnControls } from "@/features/game"

/** Live countdown (whole seconds) to the auto-skip deadline. */
function useSecondsUntil(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline == null) return
    // The interval refreshes `now`; a fresh tick lands within 500ms.
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [deadline])
  if (deadline == null) return null
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function NetworkGame({
  state,
  self,
  send,
  connected,
  reactions,
  latencies,
}: {
  state: RoomState
  self: RoomMember | undefined
  send: (message: ClientMessage) => void
  connected: boolean
  reactions: ReactionEvent[]
  latencies: Record<string, number>
}) {
  const t = useT()
  const game = state.game!
  useGameSounds(game, self?.id)

  const turnPlayer = game.players[game.currentPlayerIndex]
  const turnMember = state.members.find((m) => m.id === turnPlayer?.id)
  const turnPlayerOffline =
    game.status === "playing" && !!turnMember && !turnMember.connected

  const isMyTurn =
    game.status === "playing" && !!self && turnPlayer?.id === self.id
  // Flag a laggy (but still connected) current player, so everyone sees why the
  // turn is slow to advance — it's their upstream connection, not the game.
  const turnPlayerSlow =
    !isMyTurn &&
    !turnPlayerOffline &&
    connectionQuality(true, latencies[turnPlayer?.id]) === "poor"
  const incomingOffer =
    game.status === "playing" &&
    !!self &&
    game.pendingTrades.some((offer) => offer.toId === self.id)
  useTabAlert(isMyTurn, t("notify.yourTurn"))
  useTabAlert(incomingOffer, t("notify.tradeOffer"))

  const autoSkipIn = useSecondsUntil(
    turnPlayerOffline ? state.autoSkipAt : null
  )

  return (
    <div className="mx-auto flex min-h-svh max-w-[1600px] flex-col gap-6 p-4 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex justify-center lg:flex-1">
        <GameBoard
          state={game}
          reactions={reactions}
          localPlayerId={self?.id}
        />
      </div>

      <aside className="flex w-full flex-col gap-3 lg:w-72">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              connected ? "bg-green-500" : "bg-amber-500"
            )}
          />
          {connected ? t("net.connected") : t("net.reconnecting")}
        </div>

        {turnPlayerOffline && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <WifiOff className="size-3.5" />
              {t("net.playerOffline", { name: turnPlayer.nickname })}
            </span>
            {autoSkipIn !== null && (
              <span className="text-muted-foreground">
                {t("net.autoSkipIn", { n: autoSkipIn })}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => send({ type: "skip" })}
            >
              {t("net.skip")}
            </Button>
          </div>
        )}

        {turnPlayerSlow && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
            <WifiOff className="size-3.5 shrink-0" />
            {t("net.slowConnection", {
              name: turnPlayer.nickname,
              ms: latencies[turnPlayer.id],
            })}
          </div>
        )}

        <TurnControls
          state={game}
          send={(action) => send({ type: "action", action })}
          onNewGame={() => send({ type: "reset" })}
          localPlayerId={self?.id}
          canReset={self?.isHost ?? false}
        />
        <AuctionPanel
          state={game}
          send={(action) => send({ type: "action", action })}
          localPlayerId={self?.id}
        />
        {game.lastCard && <CardBanner card={game.lastCard} />}
        <ManagePanel
          state={game}
          send={(action) => send({ type: "action", action })}
          localPlayerId={self?.id}
        />
        <TradePanel
          state={game}
          send={(action) => send({ type: "action", action })}
          localPlayerId={self?.id}
        />
        <PlayersList
          state={game}
          members={state.members}
          latencies={latencies}
        />
        <ReactionBar onReact={(emoji) => send({ type: "reaction", emoji })} />
        <StatsButton state={game} />
        <GameLog state={game} />
      </aside>

      <GameResults
        state={game}
        onNewGame={() => send({ type: "reset" })}
        canReset={self?.isHost ?? false}
      />
      <GameEvents state={game} />
    </div>
  )
}
