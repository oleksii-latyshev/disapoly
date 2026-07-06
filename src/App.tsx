import { useState } from "react"

import { GameScreen } from "@/features/game"
import { HowToPlayButton } from "@/features/game"
import { SettingsButton } from "@/features/game"
import { SetupScreen } from "@/features/game"
import { HomeScreen } from "@/features/online"
import { RoomScreen } from "@/features/online"
import type { GameSettings, PlayerSetup } from "@/modules/game-core"
import { generateRoomId } from "@/modules/network"
import { useRoute } from "@/hooks/useRoute"

type HotSeat =
  | { kind: "off" }
  | { kind: "setup" }
  | { kind: "playing"; setups: PlayerSetup[]; settings: GameSettings }

export function App() {
  const { roomId, navigate } = useRoute()
  const [hotSeat, setHotSeat] = useState<HotSeat>({ kind: "off" })

  let screen
  if (roomId) {
    // Online room takes priority — the URL is the source of truth for it.
    screen = <RoomScreen roomId={roomId} onLeave={() => navigate(null)} />
  } else if (hotSeat.kind === "setup") {
    screen = (
      <SetupScreen
        onStart={(setups, settings) =>
          setHotSeat({ kind: "playing", setups, settings })
        }
      />
    )
  } else if (hotSeat.kind === "playing") {
    screen = (
      <GameScreen
        key={JSON.stringify(hotSeat.setups)}
        setups={hotSeat.setups}
        settings={hotSeat.settings}
        onNewGame={() => setHotSeat({ kind: "off" })}
      />
    )
  } else {
    screen = (
      <HomeScreen
        onCreateRoom={() => navigate(generateRoomId())}
        onJoinRoom={(id) => navigate(id)}
        onHotSeat={() => setHotSeat({ kind: "setup" })}
      />
    )
  }

  return (
    <>
      <div className="app-ambient" aria-hidden="true" />
      {screen}
      <SettingsButton />
      <HowToPlayButton />
    </>
  )
}

export default App
