/**
 * Authoritative room server, running as a Cloudflare Durable Object via
 * `partyserver` and deployed to your own Cloudflare account with `wrangler`.
 *
 * One DO instance per room id. It owns the room state, applies validated client
 * intents through the pure `applyClientMessage` reducer, and broadcasts the full
 * state. The state is mirrored into the DO's own (SQLite-backed) storage on each
 * change and reloaded on cold start, so a match survives a worker restart,
 * deploy, or eviction — no external database needed.
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
  abandonMatch,
  applyClientMessage,
  autoBankruptOverdue,
  autoSkip,
  createRoom,
  isAbandonable,
  nextAutoBankruptAt,
  REACTIONS,
  setConnected,
  shouldAutoSkip,
  type ClientMessage,
  type RoomState,
  type ServerMessage,
} from "../src/game/room"

/** Grace period before a disconnected player's turn is auto-skipped. */
const AUTO_SKIP_MS = 30_000

/** Grace period before an emptied-out match is abandoned (returned to lobby). */
const ABANDON_MS = 60_000

/** Storage key under which the whole room state is persisted. */
const STORAGE_KEY = "room"

/** Per-connection state: which player this socket belongs to (after join). */
type ConnState = { playerId?: string }

interface Env {
  Game: DurableObjectNamespace<DisapolyServer>
}

export class DisapolyServer extends Server<Env> {
  private state: RoomState = createRoom("")
  /** Epoch ms the single DO alarm is currently armed for, if any. */
  private armedAt: number | null = null

  async onStart() {
    // Reload a persisted match after a restart/deploy/eviction; otherwise start
    // fresh. `this.name` is the DO name == the room id used in the URL.
    const saved = await this.ctx.storage.get<RoomState>(STORAGE_KEY)
    if (saved) {
      // Every socket dropped on restart — members flip back to connected as they
      // rejoin (their absence clocks restart now). Clear the stale countdown;
      // `syncAlarm` re-derives it on rejoin.
      const now = Date.now()
      this.state = {
        ...saved,
        autoSkipAt: null,
        members: saved.members.map((m) => ({
          ...m,
          connected: false,
          disconnectedAt: now,
        })),
      }
    } else {
      this.state = createRoom(this.name)
    }
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

    // Latency probe: echo it straight back so the client can time the round-trip.
    if (message.type === "ping") {
      const pong: ServerMessage = { type: "pong", t: message.t }
      connection.send(JSON.stringify(pong))
      return
    }

    // Reactions are ephemeral: relayed straight to everyone, never stored.
    if (message.type === "reaction") {
      const playerId = connection.state?.playerId
      if (!playerId || !REACTIONS.includes(message.emoji)) return
      const relay: ServerMessage = {
        type: "reaction",
        playerId,
        emoji: message.emoji,
      }
      this.broadcast(JSON.stringify(relay))
      return
    }

    // A client's measured round-trip: relayed so everyone sees each other's ping.
    if (message.type === "latency") {
      const playerId = connection.state?.playerId
      if (!playerId) return
      const relay: ServerMessage = {
        type: "latency",
        playerId,
        ms: Math.max(0, Math.min(99999, Math.round(message.ms))),
      }
      this.broadcast(JSON.stringify(relay))
      return
    }

    if (message.type === "join") {
      // Bind this socket to its player so later intents are attributable.
      connection.setState({ playerId: message.playerId })
      this.state = applyClientMessage(this.state, message, message.playerId)
    } else if (message.type === "kick") {
      const playerId = connection.state?.playerId
      if (!playerId) return
      const before = this.state.members.length
      this.state = applyClientMessage(this.state, message, playerId)
      if (this.state.members.length !== before) {
        // Tell the kicked client first (so it stops auto-rejoining), then drop
        // their sockets — they're no longer part of this room.
        const note: ServerMessage = { type: "kicked", playerId: message.playerId }
        this.broadcast(JSON.stringify(note))
        for (const conn of this.getConnections<ConnState>()) {
          if (conn.state?.playerId === message.playerId) {
            conn.close(4000, "kicked")
          }
        }
      }
    } else {
      const playerId = connection.state?.playerId
      if (!playerId) return
      this.state = applyClientMessage(this.state, message, playerId)
    }

    this.syncAlarm()
    this.persist()
    this.broadcast(this.encode())
  }

  onClose(connection: Connection<ConnState>) {
    const playerId = connection.state?.playerId
    if (!playerId) return
    this.state = setConnected(this.state, playerId, false)
    this.syncAlarm()
    this.persist()
    this.broadcast(this.encode())
  }

  /** When an emptied-out room's match should be abandoned, or null. */
  private abandonDeadline(): number | null {
    if (!isAbandonable(this.state)) return null
    // 60s after the *last* person left (disconnect stamps make this derivable).
    const last = Math.max(
      0,
      ...this.state.members.map((m) => m.disconnectedAt ?? 0)
    )
    return (last || Date.now()) + ABANDON_MS
  }

  /**
   * DO alarm fired: run every duty whose deadline has passed — skip the absent
   * current player, force-bankrupt anyone gone > 5 min, or abandon an empty
   * room's match back to the lobby.
   */
  async onAlarm() {
    this.armedAt = null // this alarm has now fired
    const now = Date.now() + 100 // alarms may land a hair early; tolerate
    let abandoned = false

    if (
      this.state.autoSkipAt !== null &&
      now >= this.state.autoSkipAt &&
      shouldAutoSkip(this.state)
    ) {
      this.state = autoSkip(this.state)
      this.state = { ...this.state, autoSkipAt: null }
    }

    this.state = autoBankruptOverdue(this.state, now)

    const abandonAt = this.abandonDeadline()
    if (abandonAt !== null && now >= abandonAt) {
      this.state = abandonMatch(this.state)
      abandoned = true
    }

    this.syncAlarm() // a chained skip or a fresh grace period may be needed
    // An abandoned match is dead — drop its blob; otherwise keep it durable.
    if (abandoned) this.clearPersisted()
    else this.persist()
    this.broadcast(this.encode())
  }

  /**
   * Reconcile the room's single DO alarm with reality. Three duties share the
   * one alarm slot; it's armed for the earliest applicable deadline:
   *  - **skip** — someone is present but the current player is gone → skip
   *    after `AUTO_SKIP_MS` (deadline mirrored into `autoSkipAt` for a client
   *    countdown);
   *  - **bankrupt** — a player has been gone for `AUTO_BANKRUPT_MS` → they're
   *    removed and their properties return to the bank;
   *  - **abandon** — nobody is left in an in-game room → discard it after
   *    `ABANDON_MS` so it can't linger.
   */
  private syncAlarm() {
    // Skip countdown: starts when the stall is first noticed, survives resyncs.
    let skipAt: number | null = null
    if (shouldAutoSkip(this.state)) {
      skipAt = this.state.autoSkipAt ?? Date.now() + AUTO_SKIP_MS
    }
    if (this.state.autoSkipAt !== skipAt) {
      this.state = { ...this.state, autoSkipAt: skipAt }
    }

    const deadlines = [
      skipAt,
      this.abandonDeadline(),
      nextAutoBankruptAt(this.state),
    ].filter((n): n is number => n !== null)

    if (deadlines.length === 0) {
      if (this.armedAt !== null) {
        this.armedAt = null
        void this.ctx.storage.deleteAlarm()
      }
      return
    }
    const at = Math.min(...deadlines)
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    )
  },
}
