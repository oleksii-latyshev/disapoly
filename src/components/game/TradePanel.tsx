import { useState } from "react"
import { motion } from "motion/react"
import { ArrowLeftRight, Check, X } from "lucide-react"

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  BOARD,
  currentPlayer,
  isTradeValid,
  tradableTiles,
  type GameAction,
  type GameState,
  type Player,
  type TradeBundle,
  type TradeOffer,
} from "@/game"
import { useT, type TFunction } from "@/i18n"
import { cn } from "@/lib/utils"

import { GROUP_COLOR } from "./board-meta"

const EMPTY: TradeBundle = { tiles: [], money: 0, jailCards: 0 }

function shortName(name: string): string {
  return name
    .replace(/ (Avenue|Place|Railroad|Gardens|Company|Works)$/i, "")
    .trim()
}

function summarize(bundle: TradeBundle, t: TFunction): string {
  const parts = bundle.tiles.map((id) => shortName(BOARD[id].name))
  if (bundle.money > 0) parts.push(`$${bundle.money}`)
  if (bundle.jailCards > 0) parts.push(`🎟×${bundle.jailCards}`)
  return parts.length ? parts.join(", ") : t("trade.nothing")
}

type Send = (action: GameAction) => void

function BundleEditor({
  title,
  player,
  bundle,
  onChange,
  state,
}: {
  title: string
  player: Player
  bundle: TradeBundle
  onChange: (b: TradeBundle) => void
  state: GameState
}) {
  const t = useT()
  const tiles = tradableTiles(state, player.id)

  const toggle = (id: number) =>
    onChange({
      ...bundle,
      tiles: bundle.tiles.includes(id)
        ? bundle.tiles.filter((x) => x !== id)
        : [...bundle.tiles, id],
    })

  const clamp = (v: number, max: number) =>
    Math.max(0, Math.min(max, Math.floor(v) || 0))

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="truncate text-xs font-medium text-muted-foreground">
        {title} · ${player.balance}
      </span>
      <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded border p-1">
        {tiles.length === 0 && (
          <span className="px-1 text-xs text-muted-foreground">—</span>
        )}
        {tiles.map((id) => {
          const def = BOARD[id]
          const color =
            def.type === "street" ? GROUP_COLOR[def.group] : undefined
          const sel = bundle.tiles.includes(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={cn(
                "flex items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs",
                sel ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-muted"
              )}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
              />
              <span className="min-w-0 flex-1 truncate">
                {shortName(def.name)}
              </span>
              {sel && <Check className="size-3 shrink-0 text-primary" />}
            </button>
          )
        })}
      </div>
      <label className="flex items-center justify-between gap-2 text-xs">
        {t("trade.money")}
        <Input
          type="number"
          min={0}
          max={player.balance}
          value={bundle.money || ""}
          onChange={(e) =>
            onChange({
              ...bundle,
              money: clamp(Number(e.target.value), player.balance),
            })
          }
          className="h-7 w-20"
        />
      </label>
      {player.getOutOfJailCards > 0 && (
        <label className="flex items-center justify-between gap-2 text-xs">
          {t("trade.cards")}
          <Input
            type="number"
            min={0}
            max={player.getOutOfJailCards}
            value={bundle.jailCards || ""}
            onChange={(e) =>
              onChange({
                ...bundle,
                jailCards: clamp(
                  Number(e.target.value),
                  player.getOutOfJailCards
                ),
              })
            }
            className="h-7 w-20"
          />
        </label>
      )}
    </div>
  )
}

function TradeBuilder({
  state,
  send,
  localPlayerId,
}: {
  state: GameState
  send: Send
  localPlayerId?: string
}) {
  const t = useT()
  const fromId = localPlayerId ?? currentPlayer(state).id
  const me = state.players.find((p) => p.id === fromId)
  const others = state.players.filter((p) => !p.isBankrupt && p.id !== fromId)

  const [open, setOpen] = useState(false)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [give, setGive] = useState<TradeBundle>(EMPTY)
  const [receive, setReceive] = useState<TradeBundle>(EMPTY)

  if (!me || me.isBankrupt || others.length === 0) return null

  const partner = state.players.find((p) => p.id === partnerId) ?? null
  const offer: TradeOffer = { fromId, toId: partnerId ?? "", give, receive }
  const valid = partnerId !== null && isTradeValid(state, offer)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setPartnerId(others[0]?.id ?? null)
          setGive(EMPTY)
          setReceive(EMPTY)
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        <ArrowLeftRight /> {t("trade.open")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("trade.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t("trade.partner")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {others.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={p.id === partnerId ? "default" : "outline"}
                onClick={() => {
                  setPartnerId(p.id)
                  setReceive(EMPTY)
                }}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.nickname}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <BundleEditor
            title={t("trade.youGive")}
            player={me}
            bundle={give}
            onChange={setGive}
            state={state}
          />
          {partner && (
            <BundleEditor
              title={t("trade.youReceive")}
              player={partner}
              bundle={receive}
              onChange={setReceive}
              state={state}
            />
          )}
        </div>

        <Button
          disabled={!valid}
          onClick={() => {
            send({ type: "PROPOSE_TRADE", offer })
            setOpen(false)
          }}
        >
          {t("trade.send")}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function PendingTrade({
  state,
  send,
  offer,
  localPlayerId,
}: {
  state: GameState
  send: Send
  offer: TradeOffer
  localPlayerId?: string
}) {
  const t = useT()
  const reduce = usePrefersReducedMotion()
  const from = state.players.find((p) => p.id === offer.fromId)
  const to = state.players.find((p) => p.id === offer.toId)
  const hotSeat = localPlayerId === undefined
  const canRespond = hotSeat || localPlayerId === offer.toId
  const canCancel = hotSeat || localPlayerId === offer.fromId
  // Draw the eye when a decision is on this player: it's easy to miss an offer
  // that arrives out of turn.
  const awaitingMe = canRespond

  return (
    <motion.div
      key={`${offer.fromId}-${offer.toId}`}
      initial={reduce || !awaitingMe ? false : { scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex flex-col gap-2 rounded-md border bg-card p-3",
        awaitingMe && "border-primary/60 shadow-lg ring-2 ring-primary/50"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          awaitingMe ? "text-primary" : "text-muted-foreground"
        )}
      >
        <ArrowLeftRight className="size-3.5" /> {t("trade.pendingTitle")}
      </div>
      {(() => {
        // From the viewer's perspective, color what they gain green and what
        // they lose red; a spectator sees the neutral two-line summary.
        const perspective = hotSeat ? offer.toId : localPlayerId
        const isParty =
          perspective === offer.toId || perspective === offer.fromId
        if (!isParty) {
          return (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-semibold">
                  {t("trade.gives", { name: from?.nickname ?? "?" })}:
                </span>{" "}
                {summarize(offer.give, t)}
              </p>
              <p>
                <span className="font-semibold">
                  {t("trade.gives", { name: to?.nickname ?? "?" })}:
                </span>{" "}
                {summarize(offer.receive, t)}
              </p>
            </div>
          )
        }
        const gain = perspective === offer.toId ? offer.give : offer.receive
        const loss = perspective === offer.toId ? offer.receive : offer.give
        return (
          <div className="space-y-1.5 text-sm">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                + {t("trade.youReceive")}:
              </span>{" "}
              {summarize(gain, t)}
            </div>
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5">
              <span className="font-semibold text-rose-700 dark:text-rose-400">
                − {t("trade.youGive")}:
              </span>{" "}
              {summarize(loss, t)}
            </div>
          </div>
        )
      })()}

      {canRespond && (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() =>
              send({
                type: "RESPOND_TRADE",
                accept: true,
                playerId: offer.toId,
              })
            }
          >
            <Check /> {t("trade.accept")}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() =>
              send({
                type: "RESPOND_TRADE",
                accept: false,
                playerId: offer.toId,
              })
            }
          >
            <X /> {t("trade.decline")}
          </Button>
        </div>
      )}

      {!canRespond && canCancel && (
        <p className="text-xs text-muted-foreground">
          {t("trade.waiting", { name: to?.nickname ?? "?" })}
        </p>
      )}

      {canCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => send({ type: "CANCEL_TRADE", playerId: offer.fromId })}
        >
          {t("trade.cancel")}
        </Button>
      )}
    </motion.div>
  )
}

/** Trade entry point: a proposal builder, or the pending offer's controls. */
export function TradePanel({
  state,
  send,
  localPlayerId,
}: {
  state: GameState
  send: Send
  localPlayerId?: string
}) {
  if (state.status !== "playing") return null
  if (state.pendingTrade) {
    return (
      <PendingTrade
        state={state}
        send={send}
        offer={state.pendingTrade}
        localPlayerId={localPlayerId}
      />
    )
  }
  return (
    <TradeBuilder state={state} send={send} localPlayerId={localPlayerId} />
  )
}
