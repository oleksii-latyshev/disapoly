import { defineConfig } from "vitest/config"

// Standalone Vitest config (takes precedence over vite.config.ts, so tests
// don't load the React/Tailwind plugins). The game core is pure TypeScript
// with no DOM or alias imports, so a bare node environment is all it needs.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
