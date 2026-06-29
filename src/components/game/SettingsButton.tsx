import { Check, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import { BOARD_THEMES, useBoardTheme, type BoardThemeId } from "./board-theme"

const ORDER: BoardThemeId[] = ["classic", "mono", "neon"]

function ThemeSwatch({ id }: { id: BoardThemeId }) {
  const theme = BOARD_THEMES[id]
  const colors = Object.values(theme.groupColors).slice(0, 6)
  return (
    <span
      className="flex h-8 w-12 shrink-0 items-center overflow-hidden rounded border"
      style={{ backgroundColor: theme.vars["--board-inner" as keyof typeof theme.vars] as string }}
    >
      {colors.map((c, i) => (
        <span key={i} className="h-full flex-1" style={{ backgroundColor: c }} />
      ))}
    </span>
  )
}

/** Fixed bottom-left settings button → board theme picker. */
export function SettingsButton() {
  const { themeId, setThemeId } = useBoardTheme()

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Settings"
            className="fixed bottom-4 left-4 z-50 rounded-full shadow-md"
          />
        }
      >
        <Settings />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Choose a board theme.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {ORDER.map((id) => {
            const theme = BOARD_THEMES[id]
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
                  <span className="block text-sm font-medium">{theme.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {theme.description}
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
