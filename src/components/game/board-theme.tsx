/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"

import type { ColorGroup } from "@/game"

export type BoardThemeId = "classic" | "mono" | "neon"

export type BoardTheme = {
  id: BoardThemeId
  name: string
  description: string
  /** CSS variables applied to the board frame element. */
  vars: CSSProperties
  /** Tint each street tile with a faint wash of its group color. */
  tintTiles: boolean
  /** Add a neon glow to group bars, houses and tokens. */
  glow: boolean
  groupColors: Record<ColorGroup, string>
}

const VIVID: Record<ColorGroup, string> = {
  brown: "#92400e",
  lightBlue: "#38bdf8",
  pink: "#ec4899",
  orange: "#f97316",
  red: "#ef4444",
  yellow: "#eab308",
  green: "#16a34a",
  darkBlue: "#1d4ed8",
}

const GRAY: Record<ColorGroup, string> = {
  brown: "#4b5563",
  lightBlue: "#9ca3af",
  pink: "#6b7280",
  orange: "#7b8390",
  red: "#565e6b",
  yellow: "#aab2bd",
  green: "#717784",
  darkBlue: "#3f4651",
}

const NEON: Record<ColorGroup, string> = {
  brown: "#d39a52",
  lightBlue: "#3df0ff",
  pink: "#ff4fd8",
  orange: "#ff8a3d",
  red: "#ff3d5e",
  yellow: "#f5e642",
  green: "#3dff8a",
  darkBlue: "#6b7bff",
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  classic: {
    id: "classic",
    name: "Classic",
    description: "Colorful board, light and friendly.",
    vars: {
      "--board-frame": "#bfe3cf",
      "--board-inner": "#eaf6ee",
      "--tile-bg": "#ffffff",
      "--tile-border": "#cdddd2",
      "--tile-fg": "#1a2b22",
      "--center-fg": "#2f6b4f",
    } as CSSProperties,
    tintTiles: true,
    glow: false,
    groupColors: VIVID,
  },
  mono: {
    id: "mono",
    name: "Minimal",
    description: "Black & white, adapts to light/dark mode.",
    vars: {
      "--board-frame": "var(--muted)",
      "--board-inner": "var(--background)",
      "--tile-bg": "var(--card)",
      "--tile-border": "var(--border)",
      "--tile-fg": "var(--card-foreground)",
      "--center-fg": "var(--muted-foreground)",
    } as CSSProperties,
    tintTiles: false,
    glow: false,
    groupColors: GRAY,
  },
  neon: {
    id: "neon",
    name: "Neon",
    description: "Dark board with glowing colors.",
    vars: {
      "--board-frame": "#0b0b16",
      "--board-inner": "#0e0e1c",
      "--tile-bg": "#141426",
      "--tile-border": "#2a2a44",
      "--tile-fg": "#e6e6ff",
      "--center-fg": "#7af7ff",
    } as CSSProperties,
    tintTiles: false,
    glow: true,
    groupColors: NEON,
  },
}

const STORAGE_KEY = "disapoly.boardTheme"
/** Key used by the app's light/dark ThemeProvider (see theme-provider.tsx). */
const APP_THEME_KEY = "theme"

function isThemeId(value: string | null): value is BoardThemeId {
  return value === "classic" || value === "mono" || value === "neon"
}

/**
 * Initial board theme: an explicit saved choice wins; otherwise follow the
 * app/OS color scheme — Neon for dark, Classic for light.
 */
function defaultThemeId(): BoardThemeId {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (isThemeId(stored)) return stored

  const appTheme = localStorage.getItem(APP_THEME_KEY)
  let dark: boolean
  if (appTheme === "dark") dark = true
  else if (appTheme === "light") dark = false
  else dark = window.matchMedia("(prefers-color-scheme: dark)").matches
  return dark ? "neon" : "classic"
}

type BoardThemeState = {
  theme: BoardTheme
  themeId: BoardThemeId
  setThemeId: (id: BoardThemeId) => void
}

const BoardThemeContext = createContext<BoardThemeState | undefined>(undefined)

export function BoardThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<BoardThemeId>(defaultThemeId)

  const setThemeId = useCallback((id: BoardThemeId) => {
    localStorage.setItem(STORAGE_KEY, id)
    setThemeIdState(id)
  }, [])

  const value = useMemo<BoardThemeState>(
    () => ({ theme: BOARD_THEMES[themeId], themeId, setThemeId }),
    [themeId, setThemeId]
  )

  return (
    <BoardThemeContext.Provider value={value}>
      {children}
    </BoardThemeContext.Provider>
  )
}

export function useBoardTheme(): BoardThemeState {
  const context = useContext(BoardThemeContext)
  if (!context) {
    throw new Error("useBoardTheme must be used within a BoardThemeProvider")
  }
  return context
}
