import { useState } from "react"
import { Dices, Flag, HandCoins, PartyPopper } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  boardOf,
  currentPlayer,
  JAIL_FINE,
  purchasePreview,
  type GameAction,
  type GameState,
} from "@/game"
import { useT } from "@/i18n"
import { useTravelSettled } from "@/hooks/useTravelSettled"

/** Compact decision-support shown in the buy step: rent + set/collection progress. */
function BuyInfo({
  state,
  tileId,
  playerId,
}: {
  state: GameState
  tileId: number
  playerId: string
}) {
  const t = useT()
  const info = purchasePreview(state, tileId, playerId)
  if (!info) return null

  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/40 p-2 text-xs">
      {info.kind === "street" && (
        <>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{t("buy.rentLabel")}</span>
            <span className="font-medium tabular-nums">
              ${info.baseRent}
              <span className="text-muted-foreground">
                {" "}
                · {t("buy.withSet", { rent: info.rentWithSet })}
              </span>
            </span>
          </div>
          {info.completesSet ? (
            <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <PartyPopper className="size-3.5" /> {t("buy.completesSet")}
            </div>
          ) : (
            <div className="text-muted-foreground">
              {t("buy.setProgress", { owned: info.owned, total: info.total })}
            </div>
          )}
        </>
      )}
      {info.kind === "railroad" && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">
            {t("buy.railroads", { owned: info.owned, total: info.total })}
          </span>
          <span className="font-medium tabular-nums">${info.rentAfter}</span>
        </div>
      )}
      {info.kind === "utility" && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">
            {t("buy.utilities", { owned: info.owned, total: info.total })}
          </span>
          <span className="font-medium tabular-nums">
            {t("buy.timesDice", { mult: info.multiplierAfter })}
          </span>
        </div>
      )}
    </div>
  )
}

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
  // Hold actions until the token's travel animation lands on its tile.
  const settled = useTravelSettled(state)
  const [confirmingBankruptcy, setConfirmingBankruptcy] = useState(false)

  if (state.status === "finished") {
    const winner = state.players.find((p) => p.id === state.winnerId)
    return (
      <div className="flex flex-col gap-3 rounded-md border bg-card p-3 text-center">
        <p className="text-sm font-medium">
          {winner
            ? t("turn.wins", { name: winner.nickname })
            : t("turn.gameOver")}
        </p>
        {canReset ? (
          <Button onClick={onNewGame}>{t("turn.newGame")}</Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("turn.waitHostNew")}
          </p>
        )}
      </div>
    )
  }

  const player = currentPlayer(state)
  const isMyTurn = localPlayerId === undefined || player.id === localPlayerId
  const pending =
    state.pendingPurchase !== null
      ? boardOf(state)[state.pendingPurchase]
      : null
  const pendingPrice = pending && "price" in pending ? pending.price : 0

  const debt = state.pendingDebt
  const creditor = debt?.creditorId
    ? state.players.find((p) => p.id === debt.creditorId)
    : undefined

  // Whose surrender the button would declare: yourself online, whoever is
  // acting in hot-seat. Hidden once that player is already out.
  const surrenderId = localPlayerId ?? player.id
  const surrenderPlayer = state.players.find((p) => p.id === surrenderId)
  const canSurrender = !!surrenderPlayer && !surrenderPlayer.isBankrupt

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

      {state.phase === "order-roll" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{t("order.title")}</p>
          {isMyTurn && (
            <Button onClick={() => send({ type: "ROLL_DICE" })}>
              <Dices /> {t("order.roll")}
            </Button>
          )}
        </div>
      )}

      {isMyTurn && state.phase === "awaiting-roll" && !player.inJail && (
        <Button disabled={!settled} onClick={() => send({ type: "ROLL_DICE" })}>
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
          {state.pendingPurchase !== null && (
            <BuyInfo
              state={state}
              tileId={state.pendingPurchase}
              playerId={player.id}
            />
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!settled}
              onClick={() => send({ type: "BUY_PROPERTY" })}
            >
              {t("turn.buy", { price: pendingPrice })}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={!settled}
              onClick={() => send({ type: "DECLINE_PROPERTY" })}
            >
              {t("turn.decline")}
            </Button>
          </div>
        </div>
      )}

      {isMyTurn && state.phase === "awaiting-pay" && debt && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {creditor
              ? t("pay.owedTo", {
                  amount: debt.amount,
                  name: creditor.nickname,
                  tile:
                    debt.tileId !== null
                      ? boardOf(state)[debt.tileId].name
                      : "",
                })
              : t("pay.owedBank", { amount: debt.amount })}
          </p>
          {player.balance >= debt.amount ? (
            <p className="text-xs text-muted-foreground">{t("pay.hint")}</p>
          ) : (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {t("pay.short", { need: debt.amount - player.balance })}
            </p>
          )}
          <Button
            disabled={!settled || player.balance < debt.amount}
            onClick={() => send({ type: "PAY_DEBT" })}
          >
            <HandCoins /> {t("pay.pay", { amount: debt.amount })}
          </Button>
        </div>
      )}

      {!isMyTurn && state.phase === "awaiting-pay" && debt && (
        <p className="text-xs text-muted-foreground">
          {t("pay.waitingFor", { name: player.nickname, amount: debt.amount })}
        </p>
      )}

      {isMyTurn && state.phase === "awaiting-end" && (
        <Button
          variant="secondary"
          disabled={!settled}
          onClick={() => send({ type: "END_TURN" })}
        >
          {t("turn.end")}
        </Button>
      )}

      {canSurrender &&
        (confirmingBankruptcy ? (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2">
            <p className="text-xs font-medium">{t("bankrupt.confirm")}</p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setConfirmingBankruptcy(false)
                  send({ type: "DECLARE_BANKRUPTCY", playerId: surrenderId })
                }}
              >
                <Flag /> {t("bankrupt.yes")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmingBankruptcy(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-xs text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmingBankruptcy(true)}
          >
            <Flag className="size-3.5" /> {t("bankrupt.declare")}
          </Button>
        ))}
    </div>
  )
}
