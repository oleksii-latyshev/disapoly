import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/modules/theme"
import { BoardThemeProvider } from "@/features/board"
import { I18nProvider } from "@/modules/i18n"
import { SoundProvider } from "@/modules/sound"

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
