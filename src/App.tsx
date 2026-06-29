import { useState } from "react"

import { GameScreen } from "@/components/game/GameScreen"
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

  // Online room takes priority — the URL is the source of truth for it.
  if (roomId) {
    return <RoomScreen roomId={roomId} onLeave={() => navigate(null)} />
  }

  if (hotSeat.kind === "setup") {
    return (
      <SetupScreen
        onStart={(setups) => setHotSeat({ kind: "playing", setups })}
      />
    )
  }

  if (hotSeat.kind === "playing") {
    return (
      <GameScreen
        key={JSON.stringify(hotSeat.setups)}
        setups={hotSeat.setups}
        onNewGame={() => setHotSeat({ kind: "off" })}
      />
    )
  }

  return (
    <HomeScreen
      onCreateRoom={() => navigate(generateRoomId())}
      onJoinRoom={(id) => navigate(id)}
      onHotSeat={() => setHotSeat({ kind: "setup" })}
    />
  )
}

export default App
