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
import { PLAYER_COLORS, type PlayerSetup } from "@/game"
import { useT } from "@/i18n"

const MIN_PLAYERS = 2
const MAX_PLAYERS = PLAYER_COLORS.length // 8

export function SetupScreen({
  onStart,
}: {
  onStart: (players: PlayerSetup[]) => void
}) {
  const t = useT()
  const [names, setNames] = useState<string[]>(["", ""])

  const setName = (index: number, value: string) =>
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)))

  const addPlayer = () =>
    names.length < MAX_PLAYERS && setNames((prev) => [...prev, ""])
  const removePlayer = () =>
    names.length > MIN_PLAYERS && setNames((prev) => prev.slice(0, -1))

  const start = () =>
    onStart(
      names.map((nickname, i) => ({
        nickname: nickname.trim() || `Player ${i + 1}`,
      }))
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

          <Button onClick={start}>
            <Play /> {t("setup.start")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
