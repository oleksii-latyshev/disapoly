import { Gavel } from "lucide-react"
import { useState } from "react"
import {
  boardOf,
  type GameAction,
  type GameState,
  playerById,
} from "@/core/game-core"
import { useT } from "@/core/i18n"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { cn } from "@/shared/lib/utils"

/**
 * Raise/pass controls for the bidder whose turn it is. Kept in its own component
 * and remounted (via `key`) whenever the standing bid changes, so the input
 * resets to the new minimum without a state-syncing effect.
 */
function BidControls({
  minBid,
  balance,
  onBid,
  onPass,
}: {
  minBid: number
  balance: number
  onBid: (amount: number) => void
  onPass: () => void
}) {
  const t = useT()
  const [amount, setAmount] = useState(minBid)
  const canAfford = balance >= minBid
  const valid = amount >= minBid && amount <= balance

  return (
    <div className="flex gap-2">
      <Input
        type="number"
        min={minBid}
        max={balance}
        value={amount || ""}
        onChange={(e) =>
          setAmount(Math.max(0, Math.floor(Number(e.target.value)) || 0))
        }
        className="h-8 w-24"
        disabled={!canAfford}
      />
      <Button
        className="flex-1"
        disabled={!valid}
        onClick={() => onBid(amount)}
      >
        {t("auction.bid", { amount })}
      </Button>
      <Button variant="outline" onClick={onPass}>
        {t("auction.pass")}
      </Button>
    </div>
  )
}

/**
 * The live auction for a declined/unaffordable tile. Bidding is sequential:
 * status is shown to everyone, but raise/pass controls appear only for whoever's
 * turn it is to bid (in online play, only on that player's own client).
 */
export function AuctionPanel({
  state,
  send,
  localPlayerId,
}: {
  state: GameState
  send: (action: GameAction) => void
  localPlayerId?: string
}) {
  const t = useT()
  const a = state.auction
  if (!a) return null

  const minBid = a.highBid + 1
  const def = boardOf(state)[a.tileId]
  const highBidder = a.highBidderId ? playerById(state, a.highBidderId) : null
  const bidder = playerById(state, a.currentBidderId)
  const myTurn =
    localPlayerId === undefined || localPlayerId === a.currentBidderId

  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 shadow-sm">
      <div className="flex items-center gap-1.5 font-semibold text-amber-700 text-xs dark:text-amber-300">
        <Gavel className="size-3.5" /> {t("auction.title")}
      </div>
      <p className="font-medium text-sm">
        {t("auction.tileUp", { tile: def.name })}
      </p>

      <p className="text-xs">
        {highBidder ? (
          <>
            <span className="font-semibold tabular-nums">
              {t("auction.highBid", { amount: a.highBid })}
            </span>{" "}
            <span className="text-muted-foreground">
              {t("auction.highBy", { name: highBidder.nickname })}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{t("auction.noBids")}</span>
        )}
      </p>

      {/* Bidder rotation status */}
      <div className="flex flex-wrap gap-1">
        {a.bidderOrder.map((id) => {
          const p = playerById(state, id)
          if (!p) return null
          const out = !a.activeBidderIds.includes(id)
          const isCurrent = id === a.currentBidderId
          return (
            <span
              key={id}
              className={cn(
                "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px]",
                out && "line-through opacity-40",
                isCurrent && "border-amber-500 ring-1 ring-amber-500"
              )}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.nickname}
              {id === a.highBidderId && !out && (
                <span className="font-semibold">★</span>
              )}
            </span>
          )
        })}
      </div>

      {myTurn && bidder ? (
        <div className="flex flex-col gap-2">
          <div className="font-medium text-amber-700 text-xs dark:text-amber-300">
            {localPlayerId === undefined
              ? t("auction.turnOf", { name: bidder.nickname })
              : t("auction.yourTurn")}
          </div>
          <BidControls
            key={`${a.currentBidderId}-${a.highBid}`}
            minBid={minBid}
            balance={bidder.balance}
            onBid={(amount) =>
              send({ type: "PLACE_BID", amount, playerId: a.currentBidderId })
            }
            onPass={() =>
              send({ type: "PASS_BID", playerId: a.currentBidderId })
            }
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          {t("auction.waiting", { name: bidder?.nickname ?? "?" })}
        </p>
      )}
    </div>
  )
}
