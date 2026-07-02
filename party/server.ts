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
  autoSkip,
  createRoom,
  isAbandonable,
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

/** Which purpose the single DO alarm is currently serving, if any. */
type AlarmKind = "skip" | "abandon" | null

/** Storage key under which the whole room state is persisted. */
const STORAGE_KEY = "room"

/** Per-connection state: which player this socket belongs to (after join). */
type ConnState = { playerId?: string }

interface Env {
  Game: DurableObjectNamespace<DisapolyServer>
}

export class DisapolyServer extends Server<Env> {
  private state: RoomState = createRoom("")
  private alarmKind: AlarmKind = null

  async onStart() {
    // Reload a persisted match after a restart/deploy/eviction; otherwise start
    // fresh. `this.name` is the DO name == the room id used in the URL.
    const saved = await this.ctx.storage.get<RoomState>(STORAGE_KEY)
    if (saved) {
      // Every socket dropped on restart — members flip back to connected as they
      // rejoin. Clear the stale countdown; `syncAlarm` re-derives it on rejoin.
      this.state = {
        ...saved,
        autoSkipAt: null,
        members: saved.members.map((m) => ({ ...m, connected: false })),
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

    // Reactions are ephemeral: relayed straight to everyone, never stored.
    if (message.type === "reaction") {
      const playerId = connection.state?.playerId
      if (!playerId || !REACTIONS.includes(message.emoji)) return
      const relay: ServerMessage = { type: "reaction", playerId, emoji: message.emoji }
      this.broadcast(JSON.stringify(relay))
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

  /**
   * DO alarm fired: either skip the still-absent current player, or — if the
   * room has emptied out entirely — abandon the match back to the lobby.
   */
  async onAlarm() {
    this.alarmKind = null // this alarm has now fired
    let abandoned = false
    if (shouldAutoSkip(this.state)) {
      this.state = autoSkip(this.state)
      this.state = { ...this.state, autoSkipAt: null }
    } else if (isAbandonable(this.state)) {
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
   * Reconcile the room's single DO alarm with reality. Two mutually exclusive
   * needs share the one alarm slot:
   *  - **skip** — someone is present but the current player is gone → skip after
   *    `AUTO_SKIP_MS` (deadline mirrored into `autoSkipAt` for a client
   *    countdown);
   *  - **abandon** — nobody is left in an in-game room → discard it after
   *    `ABANDON_MS` so it can't linger.
   * Otherwise no alarm is armed.
   */
  private syncAlarm() {
    const kind: AlarmKind = shouldAutoSkip(this.state)
      ? "skip"
      : isAbandonable(this.state)
        ? "abandon"
        : null

    if (kind === null) {
      if (this.alarmKind !== null) {
        this.alarmKind = null
        void this.ctx.storage.deleteAlarm()
      }
      if (this.state.autoSkipAt !== null) {
        this.state = { ...this.state, autoSkipAt: null }
      }
      return
    }
    if (this.alarmKind === kind) return // already armed for this purpose

    const at = Date.now() + (kind === "skip" ? AUTO_SKIP_MS : ABANDON_MS)
    this.alarmKind = kind
    void this.ctx.storage.setAlarm(at)
    // Only the skip countdown is surfaced (nobody's watching an abandon timer).
    const autoSkipAt = kind === "skip" ? at : null
    if (this.state.autoSkipAt !== autoSkipAt) {
      this.state = { ...this.state, autoSkipAt }
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
