import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  getPlayerId,
  getStoredEmoji,
  getStoredNickname,
  setStoredNickname,
} from "@/modules/network"
import { useRoom } from "@/modules/network"
import { useT } from "@/modules/i18n"

import { LobbyScreen } from "./LobbyScreen"
import { NetworkGame } from "./NetworkGame"
import { NicknamePrompt } from "./NicknamePrompt"

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** Connects to a room and renders the lobby or the live game. */
function ConnectedRoom({
  roomId,
  playerId,
  nickname,
  onLeave,
  onRename,
}: {
  roomId: string
  playerId: string
  nickname: string
  onLeave: () => void
  onRename: (nickname: string) => void
}) {
  const t = useT()
  const identity = useMemo(
    () => ({ playerId, nickname, emoji: getStoredEmoji() }),
    [playerId, nickname]
  )
  const { state, connected, kicked, send, reactions, latencies } = useRoom(
    roomId,
    identity
  )

  if (kicked) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3">
          <p>{t("net.kicked")}</p>
          <Button variant="outline" size="sm" onClick={onLeave}>
            {t("common.back")}
          </Button>
        </div>
      </Centered>
    )
  }

  if (!state) return <Centered>{t("net.connectingRoom")}</Centered>

  const self = state.members.find((m) => m.id === playerId)

  if (state.phase === "in-game" && state.game) {
    return (
      <NetworkGame
        state={state}
        self={self}
        send={send}
        connected={connected}
        reactions={reactions}
        latencies={latencies}
      />
    )
  }

  return (
    <LobbyScreen
      roomId={roomId}
      state={state}
      self={self}
      send={send}
      connected={connected}
      onLeave={onLeave}
      onRename={onRename}
    />
  )
}

/** Asks for a nickname (once), then joins the room. */
export function RoomScreen({
  roomId,
  onLeave,
}: {
  roomId: string
  onLeave: () => void
}) {
  const playerId = useMemo(() => getPlayerId(), [])
  const [nickname, setNickname] = useState(() => getStoredNickname())

  if (!nickname) {
    return (
      <NicknamePrompt
        initial=""
        onCancel={onLeave}
        onSubmit={(name) => {
          setStoredNickname(name)
          setNickname(name)
        }}
      />
    )
  }

  return (
    <ConnectedRoom
      roomId={roomId}
      playerId={playerId}
      nickname={nickname}
      onLeave={onLeave}
      onRename={(name) => {
        // Persist and adopt the new name so a reconnect re-joins with it.
        setStoredNickname(name)
        setNickname(name)
      }}
    />
  )
}
