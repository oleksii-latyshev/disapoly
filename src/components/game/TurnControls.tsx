import { Dices } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  BOARD,
  currentPlayer,
  type GameAction,
  type GameState,
} from "@/game"

export function TurnControls({
  state,
  send,
  onNewGame,
  localPlayerId,
  canReset = true,
}: {
  state: GameState
  send: (action: GameAction) => void
  onNewGame: () => void
  /** When set (online play), action buttons show only on this player's turn. */
  localPlayerId?: string
  /** Whether this client may start a new game (host-only online). */
  canReset?: boolean
}) {
  if (state.status === "finished") {
    const winner = state.players.find((p) => p.id === state.winnerId)
    return (
      <div className="flex flex-col gap-3 rounded-md border bg-card p-3 text-center">
        <p className="text-sm font-medium">
          {winner ? `🏆 ${winner.nickname} wins!` : "Game over."}
        </p>
        {canReset ? (
          <Button onClick={onNewGame}>New game</Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Waiting for the host to start a new game…
          </p>
        )}
      </div>
    )
  }

  const player = currentPlayer(state)
  const isMyTurn = localPlayerId === undefined || player.id === localPlayerId
  const pending =
    state.pendingPurchase !== null ? BOARD[state.pendingPurchase] : null
  const pendingPrice = pending && "price" in pending ? pending.price : 0

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <p className="text-sm">
        <span
          className="mr-1.5 inline-block size-2.5 rounded-full align-middle"
          style={{ backgroundColor: player.color }}
        />
        <span className="font-semibold">{player.nickname}</span>’s turn
      </p>

      {!isMyTurn && (
        <p className="text-xs text-muted-foreground">
          Waiting for {player.nickname} to play…
        </p>
      )}

      {isMyTurn && state.phase === "awaiting-roll" && (
        <Button onClick={() => send({ type: "ROLL_DICE" })}>
          <Dices /> Roll dice
        </Button>
      )}

      {isMyTurn && state.phase === "awaiting-buy" && pending && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Buy <span className="font-medium text-foreground">{pending.name}</span>{" "}
            for ${pendingPrice}?
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => send({ type: "BUY_PROPERTY" })}
            >
              Buy ${pendingPrice}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => send({ type: "DECLINE_PROPERTY" })}
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      {isMyTurn && state.phase === "awaiting-end" && (
        <Button variant="secondary" onClick={() => send({ type: "END_TURN" })}>
          End turn
        </Button>
      )}
    </div>
  )
}
