import { useCallback, useEffect, useRef, useState } from "react"
import PartySocket from "partysocket"

import type { ClientMessage, RoomState, ServerMessage } from "@/game"
import { PARTY_HOST, PARTY_NAME } from "@/net/config"

export type RoomIdentity = {
  playerId: string
  nickname: string
  /** Preferred emoji avatar; empty = let the room assign one. */
  emoji?: string
}

/** A received emoji reaction, tagged with a local id so overlays can dedupe. */
export type ReactionEvent = { id: number; playerId: string; emoji: string }

/**
 * Connects to the authoritative PartyKit room over a WebSocket, sends the join
 * intent on open, and exposes the broadcast room state plus a typed sender.
 * Reconnection (incl. resending join) is handled by PartySocket.
 */
/** How often each client probes its round-trip time to the room server. */
const PING_INTERVAL_MS = 4000

export function useRoom(roomId: string, identity: RoomIdentity) {
  const [state, setState] = useState<RoomState | null>(null)
  const [connected, setConnected] = useState(false)
  const [kicked, setKicked] = useState(false)
  const [reactions, setReactions] = useState<ReactionEvent[]>([])
  const [latencies, setLatencies] = useState<Record<string, number>>({})
  const reactionId = useRef(0)
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
      emoji: identity.emoji || undefined,
    }

    let pingTimer: ReturnType<typeof setInterval> | null = null
    const ping = () =>
      socket.send(JSON.stringify({ type: "ping", t: Date.now() }))

    const onOpen = () => {
      setConnected(true)
      socket.send(JSON.stringify(join))
      ping() // measure immediately, then on an interval
      pingTimer = setInterval(ping, PING_INTERVAL_MS)
    }
    const onClose = () => {
      setConnected(false)
      if (pingTimer) clearInterval(pingTimer)
    }
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as ServerMessage
      if (message.type === "state") {
        setState(message.state)
      } else if (message.type === "reaction") {
        const id = ++reactionId.current
        setReactions((cur) =>
          [
            ...cur,
            { id, playerId: message.playerId, emoji: message.emoji },
          ].slice(-40)
        )
      } else if (message.type === "pong") {
        // Round-trip measured; report it so everyone sees our connection quality.
        socket.send(
          JSON.stringify({ type: "latency", ms: Date.now() - message.t })
        )
      } else if (message.type === "latency") {
        setLatencies((cur) => ({ ...cur, [message.playerId]: message.ms }))
      } else if (message.type === "kicked") {
        if (message.playerId === identity.playerId) {
          // Removed by the host: stop reconnect-rejoining and surface it.
          setKicked(true)
          socket.close()
        }
      }
    }

    socket.addEventListener("open", onOpen)
    socket.addEventListener("close", onClose)
    socket.addEventListener("message", onMessage)

    return () => {
      socket.removeEventListener("open", onOpen)
      socket.removeEventListener("close", onClose)
      socket.removeEventListener("message", onMessage)
      if (pingTimer) clearInterval(pingTimer)
      socket.close()
    }
  }, [roomId, identity.playerId, identity.nickname, identity.emoji])

  const send = useCallback((message: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(message))
  }, [])

  return { state, connected, kicked, send, reactions, latencies }
}
