import { useState } from "react"
import { Check, Copy, LogOut, Pencil, Play, UserX, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  PLAYER_EMOJIS,
  type BoardId,
  type ClientMessage,
  type PayMode,
  type RoomMember,
  type RoomState,
} from "@/game"
import { roomUrl, setStoredEmoji } from "@/net/identity"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n"

const MIN_MEMBERS = 2

const PAY_MODES: PayMode[] = ["turbo", "normal"]

const BOARD_IDS: BoardId[] = ["classic", "large"]

/** The next avatar after `current` that no other member holds. */
function nextFreeEmoji(members: RoomMember[], selfId: string): string | null {
  const self = members.find((m) => m.id === selfId)
  const taken = new Set(
    members.filter((m) => m.id !== selfId).map((m) => m.emoji)
  )
  const start = Math.max(0, PLAYER_EMOJIS.indexOf(self?.emoji ?? ""))
  for (let i = 1; i <= PLAYER_EMOJIS.length; i++) {
    const candidate = PLAYER_EMOJIS[(start + i) % PLAYER_EMOJIS.length]
    if (!taken.has(candidate) && candidate !== self?.emoji) return candidate
  }
  return null
}

export function LobbyScreen({
  roomId,
  state,
  self,
  send,
  connected,
  onLeave,
  onRename,
}: {
  roomId: string
  state: RoomState
  self: RoomMember | undefined
  send: (message: ClientMessage) => void
  connected: boolean
  onLeave: () => void
  /** Persist the new nickname locally (the server is told via `rename`). */
  onRename: (nickname: string) => void
}) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const [payMode, setPayMode] = useState<PayMode>("turbo")
  const [board, setBoard] = useState<BoardId>("classic")
  const [orderRoll, setOrderRoll] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState("")
  const url = roomUrl(roomId)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be blocked; the input is selectable as a fallback.
    }
  }

  const submitRename = () => {
    const clean = draftName.trim()
    setEditing(false)
    if (!clean || clean === self?.nickname) return
    send({ type: "rename", nickname: clean })
    onRename(clean)
  }

  const canStart = self?.isHost && state.members.length >= MIN_MEMBERS

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("lobby.title")}</CardTitle>
          <CardDescription>
            {connected ? t("lobby.share") : t("lobby.connecting")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.target.select()} />
            <Button
              variant="outline"
              size="icon"
              onClick={copy}
              aria-label={t("lobby.copyLink")}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              {t("lobby.players", { n: state.members.length })}
            </span>
            {state.members.map((member) => {
              const isSelf = member.id === self?.id
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm"
                >
                  <span
                    className="size-3 shrink-0 rounded-full border border-white/70"
                    style={{ backgroundColor: member.color }}
                  />
                  {isSelf ? (
                    <button
                      type="button"
                      className="shrink-0 cursor-pointer rounded text-base leading-none transition-transform hover:scale-125"
                      title={t("lobby.changeAvatar")}
                      aria-label={t("lobby.changeAvatar")}
                      onClick={() => {
                        const next = nextFreeEmoji(state.members, member.id)
                        if (!next) return
                        send({ type: "avatar", emoji: next })
                        setStoredEmoji(next)
                      }}
                    >
                      {member.emoji ?? "🙂"}
                    </button>
                  ) : (
                    <span className="shrink-0 text-base leading-none">
                      {member.emoji ?? "🙂"}
                    </span>
                  )}
                  {isSelf && editing ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        submitRename()
                      }}
                    >
                      <Input
                        autoFocus
                        value={draftName}
                        maxLength={24}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="h-7 flex-1 px-2 py-0 text-sm"
                        aria-label={t("lobby.rename")}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t("common.save")}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t("common.cancel")}
                        onClick={() => setEditing(false)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {member.nickname}
                        {isSelf && ` ${t("lobby.you")}`}
                      </span>
                      {isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                          aria-label={t("lobby.rename")}
                          onClick={() => {
                            setDraftName(member.nickname)
                            setEditing(true)
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {member.isHost && (
                        <span className="text-xs text-muted-foreground">
                          {t("lobby.host")}
                        </span>
                      )}
                      {self?.isHost && !isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          aria-label={t("lobby.kick", {
                            name: member.nickname,
                          })}
                          title={t("lobby.kick", { name: member.nickname })}
                          onClick={() =>
                            send({ type: "kick", playerId: member.id })
                          }
                        >
                          <UserX className="size-3.5" />
                        </Button>
                      )}
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          member.connected
                            ? "bg-green-500"
                            : "bg-muted-foreground/40"
                        )}
                        title={member.connected ? "online" : "offline"}
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {self?.isHost && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t("lobby.board")}
              </span>
              <div className="flex gap-2">
                {BOARD_IDS.map((id) => (
                  <Button
                    key={id}
                    variant={board === id ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setBoard(id)}
                  >
                    {t(`board.${id}`)}
                  </Button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {t(`board.${board}.desc`)}
              </span>
            </div>
          )}

          {self?.isHost && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t("lobby.payMode")}
              </span>
              <div className="flex gap-2">
                {PAY_MODES.map((mode) => (
                  <Button
                    key={mode}
                    variant={payMode === mode ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setPayMode(mode)}
                  >
                    {t(`payMode.${mode}`)}
                  </Button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {t(`payMode.${payMode}.desc`)}
              </span>
            </div>
          )}

          {self?.isHost && (
            <div className="flex flex-col gap-1.5">
              <Button
                variant={orderRoll ? "default" : "outline"}
                size="sm"
                onClick={() => setOrderRoll((v) => !v)}
              >
                {t("lobby.orderRoll")}:{" "}
                {orderRoll ? t("common.on") : t("common.off")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("lobby.orderRoll.desc")}
              </span>
            </div>
          )}

          {self?.isHost ? (
            <Button
              onClick={() =>
                send({ type: "start", settings: { payMode, orderRoll, board } })
              }
              disabled={!canStart}
            >
              <Play /> {t("setup.start")}{" "}
              {!canStart &&
                state.members.length < MIN_MEMBERS &&
                t("lobby.startNeed2")}
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {t("lobby.waitHost")}
            </p>
          )}

          <Button variant="ghost" size="sm" onClick={onLeave}>
            <LogOut /> {t("lobby.leave")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
