import { Check, Settings, Volume2, VolumeX } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useI18n, type Lang } from "@/i18n"
import { useSound } from "@/sound/SoundProvider"

import { BOARD_THEMES, useBoardTheme, type BoardThemeId } from "./board-theme"

const THEME_ORDER: BoardThemeId[] = ["classic", "mono", "neon"]
const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ru", label: "Русский" },
]

function ThemeSwatch({ id }: { id: BoardThemeId }) {
  const theme = BOARD_THEMES[id]
  const colors = Object.values(theme.groupColors).slice(0, 6)
  return (
    <span
      className="flex h-8 w-12 shrink-0 items-center overflow-hidden rounded border"
      style={{
        backgroundColor: theme.vars[
          "--board-inner" as keyof typeof theme.vars
        ] as string,
      }}
    >
      {colors.map((c, i) => (
        <span
          key={i}
          className="h-full flex-1"
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  )
}

/** Fixed bottom-left settings button → board theme + language picker. */
export function SettingsButton() {
  const { themeId, setThemeId } = useBoardTheme()
  const { lang, setLang, t } = useI18n()
  const { muted, setMuted, play } = useSound()

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label={t("settings.title")}
            className="fixed bottom-4 left-4 z-50 rounded-full shadow-md"
          />
        }
      >
        <Settings />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("settings.language")}
          </span>
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <Button
                key={l.id}
                variant={l.id === lang ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setLang(l.id)}
              >
                {l.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("settings.sound")}
          </span>
          <Button
            variant={muted ? "outline" : "default"}
            size="sm"
            onClick={() => {
              const next = !muted
              setMuted(next)
              if (!next) play("buy") // brief preview when enabling
            }}
          >
            {muted ? <VolumeX /> : <Volume2 />}
            {muted ? t("common.off") : t("common.on")}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("settings.boardTheme")}
          </span>
          {THEME_ORDER.map((id) => {
            const active = id === themeId
            return (
              <button
                key={id}
                type="button"
                onClick={() => setThemeId(id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                  active
                    ? "border-primary ring-2 ring-primary/30"
                    : "hover:bg-muted"
                )}
              >
                <ThemeSwatch id={id} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {t(`theme.${id}.name`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`theme.${id}.desc`)}
                  </span>
                </span>
                {active && <Check className="size-4 text-primary" />}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
