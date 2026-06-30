import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { BoardThemeProvider } from "@/components/game/board-theme.tsx"
import { I18nProvider } from "@/i18n.tsx"
import { SoundProvider } from "@/sound/SoundProvider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <BoardThemeProvider>
          <SoundProvider>
            <App />
          </SoundProvider>
        </BoardThemeProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>
)
