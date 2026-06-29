import { Dices } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  BOARD,
  currentPlayer,
  JAIL_FINE,
  type GameAction,
  type GameState,
} from "@/game"
import { useT } from "@/i18n"

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
  const t = useT()

  if (state.status === "finished") {
    const winner = state.players.find((p) => p.id === state.winnerId)
    return (
      <div className="flex flex-col gap-3 rounded-md border bg-card p-3 text-center">
        <p className="text-sm font-medium">
          {winner ? t("turn.wins", { name: winner.nickname }) : t("turn.gameOver")}
        </p>
        {canReset ? (
          <Button onClick={onNewGame}>{t("turn.newGame")}</Button>
        ) : (
          <p className="text-xs text-muted-foreground">{t("turn.waitHostNew")}</p>
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
        <span className="font-semibold">
          {t("turn.turnOf", { name: player.nickname })}
        </span>
      </p>

      {!isMyTurn && (
        <p className="text-xs text-muted-foreground">
          {t("turn.waitingFor", { name: player.nickname })}
        </p>
      )}

      {isMyTurn && state.phase === "awaiting-roll" && !player.inJail && (
        <Button onClick={() => send({ type: "ROLL_DICE" })}>
          <Dices /> {t("turn.roll")}
        </Button>
      )}

      {isMyTurn && state.phase === "awaiting-roll" && player.inJail && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {t("jail.title", { n: player.jailTurns + 1 })}
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={player.balance < JAIL_FINE}
              onClick={() => send({ type: "PAY_JAIL_FINE" })}
            >
              {t("jail.pay", { fine: JAIL_FINE })}
            </Button>
            {player.getOutOfJailCards > 0 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => send({ type: "USE_JAIL_CARD" })}
              >
                {t("jail.useCard")}
              </Button>
            )}
          </div>
          <Button
            variant="secondary"
            onClick={() => send({ type: "ROLL_DICE" })}
          >
            <Dices /> {t("jail.roll")}
          </Button>
        </div>
      )}

      {isMyTurn && state.phase === "awaiting-buy" && pending && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {t("turn.buyPrompt", { name: pending.name, price: pendingPrice })}
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => send({ type: "BUY_PROPERTY" })}
            >
              {t("turn.buy", { price: pendingPrice })}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => send({ type: "DECLINE_PROPERTY" })}
            >
              {t("turn.decline")}
            </Button>
          </div>
        </div>
      )}

      {isMyTurn && state.phase === "awaiting-end" && (
        <Button variant="secondary" onClick={() => send({ type: "END_TURN" })}>
          {t("turn.end")}
        </Button>
      )}
    </div>
  )
}
