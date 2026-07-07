// Authoritative room server: one Durable Object instance per room id
// (via partyserver). It feeds validated client intents through the pure
// `applyClientMessage` reducer, broadcasts the full state, and mirrors it
// into the DO's SQLite storage so a match survives restarts and deploys.

import { type Connection, Server, type WSMessage } from "partyserver"

import {
  applyClientMessage,
  type ClientMessage,
  createRoom,
  type RoomState,
  type ServerMessage,
  setConnected,
} from "../src/core/game-core/room"
import { STORAGE_KEY } from "./constants"
import {
  nextAlarmAt,
  runAlarmDuties,
  withAutoSkipDeadline,
} from "./helpers/deadlines"
import { latencyRelay, reactionRelay } from "./helpers/relays"
import { restoreRoom } from "./helpers/restore"

/** Per-connection state: which player this socket belongs to (after join). */
type ConnState = { playerId?: string }

export interface Env {
  Game: DurableObjectNamespace<DisapolyServer>
}

export class DisapolyServer extends Server<Env> {
  private state: RoomState = createRoom("")
  /** Epoch ms the single DO alarm is currently armed for, if any. */
  private armedAt: number | null = null

  async onStart() {
    const saved = await this.ctx.storage.get<RoomState>(STORAGE_KEY)
    this.state = saved ? restoreRoom(saved, Date.now()) : createRoom(this.name)
  }

  /** Mirror the current state into DO storage (fire-and-forget; durable at gate). */
  private persist() {
    void this.ctx.storage.put(STORAGE_KEY, this.state)
  }

  /** Drop the persisted state once a match is over and the room is dead. */
  private clearPersisted() {
    void this.ctx.storage.delete(STORAGE_KEY)
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

    if (this.relayEphemeral(connection, message)) return

    if (message.type === "join") {
      // Bind this socket to its player so later intents are attributable.
      connection.setState({ playerId: message.playerId })
      this.state = applyClientMessage(this.state, message, message.playerId)
    } else if (message.type === "kick") {
      this.handleKick(connection, message.playerId)
    } else {
      const playerId = connection.state?.playerId
      if (!playerId) return
      this.state = applyClientMessage(this.state, message, playerId)
    }

    this.syncAlarm()
    this.persist()
    this.broadcast(this.encode())
  }

  /** Ping echoes and reaction/latency relays never touch room state. */
  private relayEphemeral(
    connection: Connection<ConnState>,
    message: ClientMessage
  ): boolean {
    if (message.type === "ping") {
      const pong: ServerMessage = { type: "pong", t: message.t }
      connection.send(JSON.stringify(pong))
      return true
    }
    if (message.type === "reaction" || message.type === "latency") {
      const playerId = connection.state?.playerId
      if (playerId) {
        const relay =
          message.type === "reaction"
            ? reactionRelay(playerId, message.emoji)
            : latencyRelay(playerId, message.ms)
        if (relay) this.broadcast(JSON.stringify(relay))
      }
      return true
    }
    return false
  }

  private handleKick(connection: Connection<ConnState>, targetId: string) {
    const senderId = connection.state?.playerId
    if (!senderId) return
    const before = this.state.members.length
    this.state = applyClientMessage(
      this.state,
      { type: "kick", playerId: targetId },
      senderId
    )
    if (this.state.members.length === before) return

    // Tell the kicked client first (so it stops auto-rejoining), then drop
    // their sockets — they're no longer part of this room.
    const note: ServerMessage = { type: "kicked", playerId: targetId }
    this.broadcast(JSON.stringify(note))
    for (const conn of this.getConnections<ConnState>()) {
      if (conn.state?.playerId === targetId) {
        conn.close(4000, "kicked")
      }
    }
  }

  onClose(connection: Connection<ConnState>) {
    const playerId = connection.state?.playerId
    if (!playerId) return
    this.state = setConnected(this.state, playerId, false)
    this.syncAlarm()
    this.persist()
    this.broadcast(this.encode())
  }

  async onAlarm() {
    this.armedAt = null
    // Alarms may land a hair early; tolerate.
    const { state, abandoned } = runAlarmDuties(this.state, Date.now() + 100)
    this.state = state

    this.syncAlarm() // a chained skip or a fresh grace period may be needed
    if (abandoned) this.clearPersisted()
    else this.persist()
    this.broadcast(this.encode())
  }

  /** Arm the room's single DO alarm for the earliest applicable deadline. */
  private syncAlarm() {
    const now = Date.now()
    this.state = withAutoSkipDeadline(this.state, now)
    const at = nextAlarmAt(this.state, now)

    if (at === null) {
      if (this.armedAt !== null) {
        this.armedAt = null
        void this.ctx.storage.deleteAlarm()
      }
      return
    }
    if (this.armedAt !== at) {
      this.armedAt = at
      void this.ctx.storage.setAlarm(at)
    }
  }

  private encode(): string {
    const message: ServerMessage = { type: "state", state: this.state }
    return JSON.stringify(message)
  }
}
