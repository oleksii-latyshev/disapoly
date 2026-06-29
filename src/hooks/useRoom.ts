import { useCallback, useEffect, useRef, useState } from "react"
import PartySocket from "partysocket"

import type { ClientMessage, RoomState, ServerMessage } from "@/game"
import { PARTY_HOST, PARTY_NAME } from "@/net/config"

export type RoomIdentity = { playerId: string; nickname: string }

/**
 * Connects to the authoritative PartyKit room over a WebSocket, sends the join
 * intent on open, and exposes the broadcast room state plus a typed sender.
 * Reconnection (incl. resending join) is handled by PartySocket.
 */
export function useRoom(roomId: string, identity: RoomIdentity) {
  const [state, setState] = useState<RoomState | null>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<PartySocket | null>(null)

  useEffect(() => {
    const socket = new PartySocket({
      host: PARTY_HOST,
      party: PARTY_NAME,
      room: roomId,
    })
    socketRef.current = socket

    const join: ClientMessage = {
      type: "join",
      playerId: identity.playerId,
      nickname: identity.nickname,
    }

    const onOpen = () => {
      setConnected(true)
      socket.send(JSON.stringify(join))
    }
    const onClose = () => setConnected(false)
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as ServerMessage
      if (message.type === "state") setState(message.state)
    }

    socket.addEventListener("open", onOpen)
    socket.addEventListener("close", onClose)
    socket.addEventListener("message", onMessage)

    return () => {
      socket.removeEventListener("open", onOpen)
      socket.removeEventListener("close", onClose)
      socket.removeEventListener("message", onMessage)
      socket.close()
    }
  }, [roomId, identity.playerId, identity.nickname])

  const send = useCallback((message: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(message))
  }, [])

  return { state, connected, send }
}
