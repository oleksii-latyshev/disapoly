import { useState } from "react"

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

export function NicknamePrompt({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string
  onSubmit: (nickname: string) => void
  onCancel: () => void
}) {
  const [nickname, setNickname] = useState(initial)
  const trimmed = nickname.trim()

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join game</CardTitle>
          <CardDescription>Pick a nickname to enter the room.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (trimmed) onSubmit(trimmed)
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                autoFocus
                value={nickname}
                placeholder="Your name"
                maxLength={16}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={!trimmed}>
                Enter
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
