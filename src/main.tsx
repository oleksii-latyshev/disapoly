import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/core/theme"
import { BoardThemeProvider } from "@/features/board"
import { I18nProvider } from "@/core/i18n"
import { SoundProvider } from "@/core/sound"

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
