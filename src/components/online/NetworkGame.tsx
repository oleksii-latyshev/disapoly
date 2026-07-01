import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { WifiOff } from "lucide-react"
import type { ClientMessage, RoomMember, RoomState } from "@/game"
import { useT } from "@/i18n"
import { useGameSounds } from "@/hooks/useGameSounds"
import { useTabAlert } from "@/hooks/useTabAlert"

import { CardBanner } from "@/components/game/CardBanner"
import { GameBoard } from "@/components/game/GameBoard"
import { GameEvents } from "@/components/game/GameEvents"
import { GameLog } from "@/components/game/GameLog"
import { GameResults } from "@/components/game/GameResults"
import { ManagePanel } from "@/components/game/ManagePanel"
import { PlayersList } from "@/components/game/PlayersList"
import { StatsButton } from "@/components/game/StatsButton"
import { TradePanel } from "@/components/game/TradePanel"
import { TurnControls } from "@/components/game/TurnControls"

export function NetworkGame({
  state,
  self,
  send,
  connected,
}: {
  state: RoomState
  self: RoomMember | undefined
  send: (message: ClientMessage) => void
  connected: boolean
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
  const incomingOffer =
    game.status === "playing" && !!self && game.pendingTrade?.toId === self.id
  useTabAlert(isMyTurn, t("notify.yourTurn"))
  useTabAlert(incomingOffer, t("notify.tradeOffer"))

  return (
    <div className="mx-auto flex min-h-svh max-w-[1600px] flex-col gap-6 p-4 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex justify-center lg:flex-1">
        <GameBoard state={game} />
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => send({ type: "skip" })}
            >
              {t("net.skip")}
            </Button>
          </div>
        )}

        <TurnControls
          state={game}
          send={(action) => send({ type: "action", action })}
          onNewGame={() => send({ type: "reset" })}
          localPlayerId={self?.id}
          canReset={self?.isHost ?? false}
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
        <PlayersList state={game} />
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
