import { useState } from "react"
import { Gamepad2, Users } from "lucide-react"

import { Button } from "@/shared/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import { Input } from "@/shared/components/ui/input"
import { Separator } from "@/shared/components/ui/separator"
import { useT } from "@/core/i18n"

export function HomeScreen({
  onCreateRoom,
  onJoinRoom,
  onHotSeat,
}: {
  onCreateRoom: () => void
  onJoinRoom: (roomId: string) => void
  onHotSeat: () => void
}) {
  const t = useT()
  const [code, setCode] = useState("")
  const trimmed = code.trim()

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Disapoly</CardTitle>
          <CardDescription>{t("home.tagline")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={onCreateRoom}>
            <Users /> {t("home.createRoom")}
          </Button>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (trimmed) onJoinRoom(trimmed)
            }}
          >
            <Input
              value={code}
              placeholder={t("home.roomCode")}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!trimmed}>
              {t("home.join")}
            </Button>
          </form>

          <Separator />

          <Button variant="ghost" onClick={onHotSeat}>
            <Gamepad2 /> {t("home.hotseat")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
