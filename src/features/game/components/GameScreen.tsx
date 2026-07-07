import type { GameSettings, PlayerSetup } from "@/core/game-core"
import { useGame } from "../hooks/useGame"
import { useGameSounds } from "../hooks/useGameSounds"

import { AuctionPanel } from "@/features/auction"
import { CardBanner } from "./CardBanner"
import { GameBoard } from "@/features/board"
import { GameEvents } from "./GameEvents"
import { GameLog } from "./GameLog"
import { GameResults } from "./GameResults"
import { ManagePanel } from "./ManagePanel"
import { PlayersList } from "./PlayersList"
import { StatsButton } from "./StatsButton"
import { TradePanel } from "@/features/trade"
import { TurnControls } from "./TurnControls"

export function GameScreen({
  setups,
  settings,
  onNewGame,
}: {
  setups: PlayerSetup[]
  settings?: GameSettings
  onNewGame: () => void
}) {
  const { state, send } = useGame(setups, undefined, settings)
  useGameSounds(state)

  return (
    <div className="mx-auto flex min-h-svh max-w-[1600px] flex-col gap-6 p-4 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex justify-center lg:flex-1">
        <GameBoard state={state} />
      </div>

      <aside className="flex w-full flex-col gap-3 lg:w-72">
        <TurnControls state={state} send={send} onNewGame={onNewGame} />
        <AuctionPanel state={state} send={send} />
        {state.lastCard && <CardBanner card={state.lastCard} />}
        <ManagePanel state={state} send={send} />
        <TradePanel state={state} send={send} />
        <PlayersList state={state} />
        <StatsButton state={state} />
        <GameLog state={state} />
      </aside>

      <GameResults state={state} onNewGame={onNewGame} />
      <GameEvents state={state} />
    </div>
  )
}
