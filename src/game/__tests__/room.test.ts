/** Multiplayer room authority: settings, rename, kick, auto-bankrupt. */

import { describe, expect, it } from "vitest"

import {
  applyClientMessage,
  autoBankruptOverdue,
  AUTO_BANKRUPT_MS,
  createRoom,
  nextAutoBankruptAt,
  setConnected,
  type RoomState,
} from "../room"

function lobbyWith(...ids: string[]): RoomState {
  let room = createRoom("test")
  for (const id of ids) {
    room = applyClientMessage(
      room,
      { type: "join", playerId: id, nickname: id.toUpperCase() },
      id
    )
  }
  return room
}

function started(room: RoomState, hostId = "a"): RoomState {
  return applyClientMessage(room, { type: "start" }, hostId)
}

describe("start settings", () => {
  it("threads the host's pay mode into the game", () => {
    const room = applyClientMessage(
      lobbyWith("a", "b"),
      { type: "start", settings: { payMode: "normal" } },
      "a"
    )
    expect(room.game?.settings.payMode).toBe("normal")
  })

  it("defaults to turbo when no settings are sent", () => {
    const room = started(lobbyWith("a", "b"))
    expect(room.game?.settings.payMode).toBe("turbo")
  })
})

describe("emoji avatars", () => {
  it("assigns unique avatars on join and honors a free preference", () => {
    let room = lobbyWith("a", "b")
    const [a, b] = room.members
    expect(a.emoji).not.toBe(b.emoji)

    room = applyClientMessage(
      room,
      { type: "join", playerId: "c", nickname: "C", emoji: "🦖" },
      "c"
    )
    expect(room.members.find((m) => m.id === "c")?.emoji).toBe("🦖")

    // Someone else's avatar can't be claimed — a free one is assigned instead.
    const d = applyClientMessage(
      room,
      { type: "join", playerId: "d", nickname: "D", emoji: "🦖" },
      "d"
    )
    expect(d.members.find((m) => m.id === "d")?.emoji).not.toBe("🦖")
  })

  it("changes via the avatar message and syncs the in-game player", () => {
    let room = started(lobbyWith("a", "b"))
    room = applyClientMessage(room, { type: "avatar", emoji: "🦀" }, "b")
    expect(room.members.find((m) => m.id === "b")?.emoji).toBe("🦀")
    expect(room.game?.players.find((p) => p.id === "b")?.emoji).toBe("🦀")
  })

  it("rejects a taken or unknown emoji", () => {
    const room = lobbyWith("a", "b")
    const aEmoji = room.members[0].emoji
    expect(applyClientMessage(room, { type: "avatar", emoji: aEmoji }, "b"))
      .toBe(room)
    expect(applyClientMessage(room, { type: "avatar", emoji: "💩" }, "b"))
      .toBe(room)
  })

  it("a reconnect join keeps the changed avatar", () => {
    let room = started(lobbyWith("a", "b"))
    room = applyClientMessage(room, { type: "avatar", emoji: "🦀" }, "b")
    room = setConnected(room, "b", false, 1000)
    // Reconnect sends the stale localStorage preference — it must not revert.
    room = applyClientMessage(
      room,
      { type: "join", playerId: "b", nickname: "B", emoji: "🐼" },
      "b"
    )
    expect(room.members.find((m) => m.id === "b")?.emoji).toBe("🦀")
  })
})

describe("rename", () => {
  it("renames the member and their in-game player", () => {
    let room = started(lobbyWith("a", "b"))
    room = applyClientMessage(room, { type: "rename", nickname: "Neo" }, "b")
    expect(room.members.find((m) => m.id === "b")?.nickname).toBe("Neo")
    expect(room.game?.players.find((p) => p.id === "b")?.nickname).toBe("Neo")
  })

  it("ignores blank names and unknown senders", () => {
    const room = lobbyWith("a", "b")
    expect(applyClientMessage(room, { type: "rename", nickname: "  " }, "a"))
      .toBe(room)
    expect(applyClientMessage(room, { type: "rename", nickname: "X" }, "zz"))
      .toBe(room)
  })
})

describe("kick", () => {
  it("host removes a member in the lobby; they can't rejoin", () => {
    let room = lobbyWith("a", "b", "c")
    room = applyClientMessage(room, { type: "kick", playerId: "b" }, "a")
    expect(room.members.map((m) => m.id)).toEqual(["a", "c"])
    expect(room.kickedIds).toContain("b")

    const rejoined = applyClientMessage(
      room,
      { type: "join", playerId: "b", nickname: "B" },
      "b"
    )
    expect(rejoined.members.map((m) => m.id)).toEqual(["a", "c"])
  })

  it("only the host can kick, never themselves, and only in the lobby", () => {
    const lobby = lobbyWith("a", "b")
    expect(applyClientMessage(lobby, { type: "kick", playerId: "a" }, "b"))
      .toBe(lobby)
    expect(applyClientMessage(lobby, { type: "kick", playerId: "a" }, "a"))
      .toBe(lobby)
    const inGame = started(lobby)
    expect(applyClientMessage(inGame, { type: "kick", playerId: "b" }, "a"))
      .toBe(inGame)
  })
})

describe("server-only actions", () => {
  it("rejects FORCE_BANKRUPT and FORCE_END_TURN from clients", () => {
    const room = started(lobbyWith("a", "b"))
    expect(
      applyClientMessage(
        room,
        { type: "action", action: { type: "FORCE_BANKRUPT", playerId: "b" } },
        "a"
      )
    ).toBe(room)
    expect(
      applyClientMessage(
        room,
        { type: "action", action: { type: "FORCE_END_TURN" } },
        "a"
      )
    ).toBe(room)
  })

  it("stamps DECLARE_BANKRUPTCY with the sender's id (no spoofing)", () => {
    const room = started(lobbyWith("a", "b"))
    const out = applyClientMessage(
      room,
      // "b" tries to bankrupt "a" — the stamp makes it self-inflicted.
      { type: "action", action: { type: "DECLARE_BANKRUPTCY", playerId: "a" } },
      "b"
    )
    expect(out.game?.players.find((p) => p.id === "a")?.isBankrupt).toBe(false)
    expect(out.game?.players.find((p) => p.id === "b")?.isBankrupt).toBe(true)
  })
})

describe("disconnect auto-bankrupt", () => {
  it("computes the earliest deadline and removes overdue players", () => {
    const t0 = 1_000_000
    let room = started(lobbyWith("a", "b", "c"))
    room = setConnected(room, "b", false, t0)
    room = setConnected(room, "c", false, t0 + 60_000)

    expect(nextAutoBankruptAt(room)).toBe(t0 + AUTO_BANKRUPT_MS)

    // Just before the deadline: nothing happens.
    const early = autoBankruptOverdue(room, t0 + AUTO_BANKRUPT_MS - 1)
    expect(early.game?.players.some((p) => p.isBankrupt)).toBe(false)

    // Past b's deadline (c still within grace): only b is removed.
    const later = autoBankruptOverdue(room, t0 + AUTO_BANKRUPT_MS + 1)
    expect(later.game?.players.find((p) => p.id === "b")?.isBankrupt).toBe(true)
    expect(later.game?.players.find((p) => p.id === "c")?.isBankrupt).toBe(
      false
    )
    expect(nextAutoBankruptAt(later)).toBe(t0 + 60_000 + AUTO_BANKRUPT_MS)
  })

  it("never fires in an empty room (abandon handles that)", () => {
    const t0 = 1_000_000
    let room = started(lobbyWith("a", "b"))
    room = setConnected(room, "a", false, t0)
    room = setConnected(room, "b", false, t0)
    expect(nextAutoBankruptAt(room)).toBeNull()
    expect(autoBankruptOverdue(room, t0 + AUTO_BANKRUPT_MS * 2)).toBe(room)
  })

  it("reconnecting clears the clock", () => {
    const t0 = 1_000_000
    let room = started(lobbyWith("a", "b"))
    room = setConnected(room, "b", false, t0)
    room = applyClientMessage(
      room,
      { type: "join", playerId: "b", nickname: "B" },
      "b"
    )
    expect(nextAutoBankruptAt(room)).toBeNull()
  })
})
