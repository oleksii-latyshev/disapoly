import { useState } from "react"

import { GameScreen } from "@/components/game/GameScreen"
import { HowToPlayButton } from "@/components/game/HowToPlayButton"
import { SettingsButton } from "@/components/game/SettingsButton"
import { SetupScreen } from "@/components/game/SetupScreen"
import { HomeScreen } from "@/components/online/HomeScreen"
import { RoomScreen } from "@/components/online/RoomScreen"
import type { PlayerSetup } from "@/game"
import { generateRoomId } from "@/net/identity"
import { useRoute } from "@/hooks/useRoute"

type HotSeat =
  | { kind: "off" }
  | { kind: "setup" }
  | { kind: "playing"; setups: PlayerSetup[] }

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
        onStart={(setups) => setHotSeat({ kind: "playing", setups })}
      />
    )
  } else if (hotSeat.kind === "playing") {
    screen = (
      <GameScreen
        key={JSON.stringify(hotSeat.setups)}
        setups={hotSeat.setups}
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
      {screen}
      <SettingsButton />
      <HowToPlayButton />
    </>
  )
}

export default App
