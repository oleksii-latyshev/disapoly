import { useState } from "react"

import { GameScreen } from "@/components/game/GameScreen"
import { SetupScreen } from "@/components/game/SetupScreen"
import type { PlayerSetup } from "@/game"

export function App() {
  const [setups, setSetups] = useState<PlayerSetup[] | null>(null)

  if (!setups) {
    return <SetupScreen onStart={setSetups} />
  }

  return (
    // Remount per match so a fresh game state is created.
    <GameScreen
      key={JSON.stringify(setups)}
      setups={setups}
      onNewGame={() => setSetups(null)}
    />
  )
}

export default App
