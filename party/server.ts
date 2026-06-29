/**
 * Authoritative room server, running as a Cloudflare Durable Object via
 * `partyserver` and deployed to your own Cloudflare account with `wrangler`.
 *
 * One DO instance per room id. It owns the room state, applies validated client
 * intents through the pure `applyClientMessage` reducer, and broadcasts the full
 * state. No database: state lives only in this object's memory for the duration
 * of the match.
 *
 * Run locally: `bun run dev:party`  (wrangler dev, no account needed).
 * Deploy:      `bun run deploy:party` (needs `wrangler login`).
 */

import {
  routePartykitRequest,
  Server,
  type Connection,
  type WSMessage,
} from "partyserver"

import {
  applyClientMessage,
  createRoom,
  setConnected,
  type ClientMessage,
  type RoomState,
  type ServerMessage,
} from "../src/game/room"

/** Per-connection state: which player this socket belongs to (after join). */
type ConnState = { playerId?: string }

interface Env {
  Game: DurableObjectNamespace<DisapolyServer>
}

export class DisapolyServer extends Server<Env> {
  private state: RoomState = createRoom("")

  onStart() {
    // `this.name` is the DO name == the room id used in the URL.
    this.state = createRoom(this.name)
  }

  onConnect(connection: Connection<ConnState>) {
    connection.send(this.encode())
  }

  onMessage(connection: Connection<ConnState>, raw: WSMessage) {
    if (typeof raw !== "string") return

    let message: ClientMessage
    try {
      message = JSON.parse(raw) as ClientMessage
    } catch {
      return
    }

    if (message.type === "join") {
      // Bind this socket to its player so later intents are attributable.
      connection.setState({ playerId: message.playerId })
      this.state = applyClientMessage(this.state, message, message.playerId)
    } else {
      const playerId = connection.state?.playerId
      if (!playerId) return
      this.state = applyClientMessage(this.state, message, playerId)
    }

    this.broadcast(this.encode())
  }

  onClose(connection: Connection<ConnState>) {
    const playerId = connection.state?.playerId
    if (!playerId) return
    this.state = setConnected(this.state, playerId, false)
    this.broadcast(this.encode())
  }

  private encode(): string {
    const message: ServerMessage = { type: "state", state: this.state }
    return JSON.stringify(message)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    )
  },
}
