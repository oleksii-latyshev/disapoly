import { useState } from "react"
import { Check, Copy, LogOut, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { ClientMessage, RoomMember, RoomState } from "@/game"
import { roomUrl } from "@/net/identity"
import { cn } from "@/lib/utils"

const MIN_MEMBERS = 2

export function LobbyScreen({
  roomId,
  state,
  self,
  send,
  connected,
  onLeave,
}: {
  roomId: string
  state: RoomState
  self: RoomMember | undefined
  send: (message: ClientMessage) => void
  connected: boolean
  onLeave: () => void
}) {
  const [copied, setCopied] = useState(false)
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

  const canStart = self?.isHost && state.members.length >= MIN_MEMBERS

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Lobby</CardTitle>
          <CardDescription>
            {connected ? "Share the link to invite friends." : "Connecting…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="icon" onClick={copy} aria-label="Copy link">
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              Players ({state.members.length})
            </span>
            {state.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm"
              >
                <span
                  className="size-3 shrink-0 rounded-full border border-white/70"
                  style={{ backgroundColor: member.color }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {member.nickname}
                  {member.id === self?.id && " (you)"}
                </span>
                {member.isHost && (
                  <span className="text-xs text-muted-foreground">host</span>
                )}
                <span
                  className={cn(
                    "size-2 rounded-full",
                    member.connected ? "bg-green-500" : "bg-muted-foreground/40"
                  )}
                  title={member.connected ? "online" : "offline"}
                />
              </div>
            ))}
          </div>

          {self?.isHost ? (
            <Button onClick={() => send({ type: "start" })} disabled={!canStart}>
              <Play /> Start game{" "}
              {!canStart && state.members.length < MIN_MEMBERS && "(need 2+)"}
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Waiting for the host to start…
            </p>
          )}

          <Button variant="ghost" size="sm" onClick={onLeave}>
            <LogOut /> Leave
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
