import { useState } from "react"
import { Minus, Play, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ALL_EVENT_KINDS,
  PLAYER_COLORS,
  PLAYER_EMOJIS,
  type BoardEventKind,
  type BoardId,
  type EventFrequency,
  type GameSettings,
  type PayMode,
  type PlayerSetup,
} from "@/modules/game-core"
import { useT } from "@/modules/i18n"

import { EventSettings } from "@/features/events"

const MIN_PLAYERS = 2
const MAX_PLAYERS = PLAYER_COLORS.length // 8

const PAY_MODES: PayMode[] = ["turbo", "normal"]

const BOARD_IDS: BoardId[] = ["classic", "large"]

export function SetupScreen({
  onStart,
}: {
  onStart: (players: PlayerSetup[], settings: GameSettings) => void
}) {
  const t = useT()
  const [names, setNames] = useState<string[]>(["", ""])
  const [emojis, setEmojis] = useState<string[]>([
    PLAYER_EMOJIS[0],
    PLAYER_EMOJIS[1],
  ])
  const [payMode, setPayMode] = useState<PayMode>("turbo")
  const [board, setBoard] = useState<BoardId>("classic")
  const [orderRoll, setOrderRoll] = useState(false)
  const [events, setEvents] = useState(false)
  const [eventKinds, setEventKinds] = useState<BoardEventKind[]>([
    ...ALL_EVENT_KINDS,
  ])
  const [eventFrequency, setEventFrequency] = useState<EventFrequency>("normal")

  const setName = (index: number, value: string) =>
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)))

  /** Advance one player's avatar to the next emoji nobody else has taken. */
  const cycleEmoji = (index: number) =>
    setEmojis((prev) => {
      const taken = new Set(prev.filter((_, i) => i !== index))
      const start = Math.max(0, PLAYER_EMOJIS.indexOf(prev[index]))
      for (let i = 1; i <= PLAYER_EMOJIS.length; i++) {
        const candidate = PLAYER_EMOJIS[(start + i) % PLAYER_EMOJIS.length]
        if (!taken.has(candidate)) {
          return prev.map((e, j) => (j === index ? candidate : e))
        }
      }
      return prev
    })

  const addPlayer = () => {
    if (names.length >= MAX_PLAYERS) return
    setNames((prev) => [...prev, ""])
    setEmojis((prev) => {
      const taken = new Set(prev)
      const free = PLAYER_EMOJIS.find((e) => !taken.has(e)) ?? PLAYER_EMOJIS[0]
      return [...prev, free]
    })
  }
  const removePlayer = () => {
    if (names.length <= MIN_PLAYERS) return
    setNames((prev) => prev.slice(0, -1))
    setEmojis((prev) => prev.slice(0, -1))
  }

  const start = () =>
    onStart(
      names.map((nickname, i) => ({
        nickname: nickname.trim() || `Player ${i + 1}`,
        emoji: emojis[i],
      })),
      { payMode, orderRoll, board, events, eventKinds, eventFrequency }
    )

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Disapoly</CardTitle>
          <CardDescription>
            {t("setup.desc", { max: MAX_PLAYERS })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {names.map((name, index) => (
              <div key={index} className="flex items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full border border-white/70"
                  style={{ backgroundColor: PLAYER_COLORS[index] }}
                />
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded text-lg leading-none transition-transform hover:scale-125"
                  title={t("lobby.changeAvatar")}
                  aria-label={t("lobby.changeAvatar")}
                  onClick={() => cycleEmoji(index)}
                >
                  {emojis[index]}
                </button>
                <Label className="sr-only" htmlFor={`player-${index}`}>
                  {t("setup.playerN", { n: index + 1 })}
                </Label>
                <Input
                  id={`player-${index}`}
                  value={name}
                  placeholder={t("setup.playerN", { n: index + 1 })}
                  maxLength={16}
                  onChange={(e) => setName(index, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("setup.players", { n: names.length })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={removePlayer}
                disabled={names.length <= MIN_PLAYERS}
                aria-label={t("setup.removePlayer")}
              >
                <Minus />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={addPlayer}
                disabled={names.length >= MAX_PLAYERS}
                aria-label={t("setup.addPlayer")}
              >
                <Plus />
              </Button>
            </div>
          </div>

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

          <EventSettings
            events={events}
            onEventsChange={setEvents}
            frequency={eventFrequency}
            onFrequencyChange={setEventFrequency}
            kinds={eventKinds}
            onKindsChange={setEventKinds}
          />

          <Button onClick={start}>
            <Play /> {t("setup.start")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
