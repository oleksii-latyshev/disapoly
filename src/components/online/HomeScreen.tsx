import { useState } from "react"
import { Gamepad2, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

export function HomeScreen({
  onCreateRoom,
  onJoinRoom,
  onHotSeat,
}: {
  onCreateRoom: () => void
  onJoinRoom: (roomId: string) => void
  onHotSeat: () => void
}) {
  const [code, setCode] = useState("")
  const trimmed = code.trim()

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Disapoly</CardTitle>
          <CardDescription>
            Create a room and share the link with friends — no sign-up.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button onClick={onCreateRoom}>
            <Users /> Create online room
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
              placeholder="Room code"
              onChange={(e) => setCode(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!trimmed}>
              Join
            </Button>
          </form>

          <Separator />

          <Button variant="ghost" onClick={onHotSeat}>
            <Gamepad2 /> Play hot-seat (one device)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
