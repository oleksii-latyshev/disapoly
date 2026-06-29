import { cn } from "@/lib/utils"
import type { ClientMessage, RoomMember, RoomState } from "@/game"
import { useT } from "@/i18n"

import { CardBanner } from "@/components/game/CardBanner"
import { GameBoard } from "@/components/game/GameBoard"
import { GameLog } from "@/components/game/GameLog"
import { ManagePanel } from "@/components/game/ManagePanel"
import { PlayersList } from "@/components/game/PlayersList"
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

  return (
    <div className="mx-auto flex min-h-svh max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:items-start lg:justify-center">
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
        <PlayersList state={game} />
        <GameLog state={game} />
      </aside>
    </div>
  )
}
