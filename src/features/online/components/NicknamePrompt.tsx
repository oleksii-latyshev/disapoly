import { useState } from "react"
import { useT } from "@/core/i18n"
import { Button } from "@/shared/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"

export function NicknamePrompt({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string
  onSubmit: (nickname: string) => void
  onCancel: () => void
}) {
  const t = useT()
  const [nickname, setNickname] = useState(initial)
  const trimmed = nickname.trim()

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("nickname.title")}</CardTitle>
          <CardDescription>{t("nickname.desc")}</CardDescription>
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
              <Label htmlFor="nickname">{t("nickname.label")}</Label>
              <Input
                id="nickname"
                autoFocus
                value={nickname}
                placeholder={t("nickname.placeholder")}
                maxLength={16}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={!trimmed}>
                {t("nickname.enter")}
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t("common.back")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
