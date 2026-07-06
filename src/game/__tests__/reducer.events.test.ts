import { describe, expect, it } from "vitest"

import { applyInstantEvent } from "../events"
import { gameReducer } from "../reducer"
import type { BoardEvent, GameState } from "../types"
import { newGame, player, withNextRoll } from "./helpers"

/** Stage a live event on the state (tests mutate before dispatching). */
function withEvent(state: GameState, event: BoardEvent): GameState {
  return { ...state, activeEvent: event }
}

function logKeys(state: GameState): string[] {
  return state.log.map((e) => e.key)
}

describe("surprise events", () => {
  it("never spawns an event with the setting off", () => {
    let state = newGame(2, 42) // events default to off
    for (let i = 0; i < 60; i++) {
      state = gameReducer(state, { type: "FORCE_END_TURN" })
      expect(state.activeEvent ?? null).toBeNull()
    }
    expect(logKeys(state).some((k) => k.startsWith("log.event"))).toBe(false)
  })

  it("spawns an event eventually with the setting on, but not before one round", () => {
    let state = newGame(2, 42, { events: true })
    state = gameReducer(state, { type: "FORCE_END_TURN" })
    expect(state.activeEvent ?? null).toBeNull() // turn 1 < one full round
    expect(logKeys(state).some((k) => k.startsWith("log.event"))).toBe(false)

    let seen = false
    for (let i = 0; i < 200 && !seen; i++) {
      state = gameReducer(state, { type: "FORCE_END_TURN" })
      seen =
        !!state.activeEvent ||
        logKeys(state).some((k) => k.startsWith("log.event"))
    }
    expect(seen).toBe(true)
  })

  it("holds the post-event cooldown before rolling for the next spawn", () => {
    let state = newGame(2, 42, { events: true })
    state.eventCooldownUntil = 100
    for (let i = 0; i < 60; i++) {
      state = gameReducer(state, { type: "FORCE_END_TURN" })
      expect(state.activeEvent ?? null).toBeNull()
    }
    expect(logKeys(state).some((k) => k.startsWith("log.event"))).toBe(false)
  })

  it("pays a bounty to the first player landing on its tile", () => {
    let state = newGame(2, 42, { events: true })
    state = withEvent(state, {
      kind: "bounty",
      tileId: 5, // Reading Railroad — 5 steps from GO
      amount: 200,
      expiresAtTurn: 999,
    })
    state = gameReducer(withNextRoll(state, 2, 3), { type: "ROLL_DICE" })

    expect(player(state, "p1").balance).toBe(1500 + 200)
    expect(state.activeEvent).toBeNull()
    expect(logKeys(state)).toContain("log.eventBountyClaimed")
  })

  it("claims the bounty before the tile charges rent", () => {
    let state = newGame(2, 42, { events: true })
    state.tiles[5].ownerId = "p2" // Reading Railroad, rent $25
    state = withEvent(state, {
      kind: "bounty",
      tileId: 5,
      amount: 150,
      expiresAtTurn: 999,
    })
    state = gameReducer(withNextRoll(state, 2, 3), { type: "ROLL_DICE" })

    expect(player(state, "p1").balance).toBe(1500 + 150 - 25)
    expect(player(state, "p2").balance).toBe(1500 + 25)
  })

  it("hops the rabbit to a new tile at the end of a turn", () => {
    let state = newGame(2, 42, { events: true })
    state = withEvent(state, {
      kind: "rabbit",
      tileId: 5,
      amount: 100,
      expiresAtTurn: 999,
    })
    state = gameReducer(state, { type: "FORCE_END_TURN" })

    const event = state.activeEvent!
    expect(event.kind).toBe("rabbit")
    expect(event.tileId).not.toBe(5)
    const hopped = (event.tileId! - 5 + 40) % 40
    expect(hopped).toBeGreaterThanOrEqual(1)
    expect(hopped).toBeLessThanOrEqual(6)
  })

  it("pays the prize when the rabbit is caught", () => {
    let state = newGame(2, 42, { events: true })
    state = withEvent(state, {
      kind: "rabbit",
      tileId: 8, // Vermont Avenue
      amount: 250,
      expiresAtTurn: 999,
    })
    state = gameReducer(withNextRoll(state, 3, 5), { type: "ROLL_DICE" })

    expect(player(state, "p1").balance).toBe(1500 + 250)
    expect(state.activeEvent).toBeNull()
    expect(logKeys(state)).toContain("log.eventRabbitCaught")
  })

  it("expires an unclaimed event at its deadline and starts the cooldown", () => {
    let state = newGame(2, 42, { events: true })
    state = withEvent(state, {
      kind: "bounty",
      tileId: 5,
      amount: 200,
      expiresAtTurn: state.turnCount + 1,
    })
    state = gameReducer(state, { type: "FORCE_END_TURN" })

    expect(state.activeEvent).toBeNull()
    expect(logKeys(state)).toContain("log.eventEnded")
    expect(state.eventCooldownUntil).toBe(state.turnCount + 2)
  })

  it("starts the cooldown when a bounty is claimed", () => {
    let state = newGame(2, 42, { events: true })
    state = withEvent(state, {
      kind: "bounty",
      tileId: 5,
      amount: 200,
      expiresAtTurn: 999,
    })
    state = gameReducer(withNextRoll(state, 2, 3), { type: "ROLL_DICE" })

    expect(state.activeEvent).toBeNull()
    expect(state.eventCooldownUntil).toBe(state.turnCount + 2)
  })

  it("doubles rent while a rent surge ('boom day') is active", () => {
    let state = newGame(2, 42, { events: true })
    state.tiles[5].ownerId = "p2" // Reading Railroad, rent $25
    state = withEvent(state, {
      kind: "rentSurge",
      tileId: null,
      amount: 0,
      expiresAtTurn: 999,
    })
    state = gameReducer(withNextRoll(state, 2, 3), { type: "ROLL_DICE" })

    expect(player(state, "p1").balance).toBe(1500 - 50)
    expect(player(state, "p2").balance).toBe(1500 + 50)
    const rent = state.log.find((e) => e.key === "log.rent")
    expect(rent?.params?.rent).toBe(50)
  })

  it("earthquake collapses one building back to the bank", () => {
    const state = newGame(2, 42, { events: true })
    state.tiles[1].ownerId = "p1"
    state.tiles[3].ownerId = "p1"
    state.tiles[1].houses = 2
    state.bank.houses = 30

    applyInstantEvent(state, "earthquake")

    expect(state.tiles[1].houses).toBe(1)
    expect(state.bank.houses).toBe(31)
    expect(logKeys(state)).toContain("log.eventEarthquake")
  })

  it("earthquake is a no-op when nothing is built", () => {
    const state = newGame(2, 42, { events: true })
    applyInstantEvent(state, "earthquake")
    expect(logKeys(state)).not.toContain("log.eventEarthquake")
    expect(state.bank.houses).toBe(32)
  })

  it("windfall pays every active player the same amount", () => {
    const state = newGame(3, 42, { events: true })
    state.players[2].isBankrupt = true

    applyInstantEvent(state, "windfall")

    const entry = state.log.find((e) => e.key === "log.eventWindfall")
    const amount = entry?.params?.amount as number
    expect(amount).toBeGreaterThanOrEqual(50)
    expect(amount).toBeLessThanOrEqual(150)
    expect(player(state, "p1").balance).toBe(1500 + amount)
    expect(player(state, "p2").balance).toBe(1500 + amount)
    expect(player(state, "p3").balance).toBe(1500) // bankrupt players sit out
  })

  it("jailbreak frees every jailed player", () => {
    const state = newGame(2, 42, { events: true })
    state.players[1].inJail = true
    state.players[1].jailTurns = 2

    applyInstantEvent(state, "jailbreak")

    expect(player(state, "p2").inJail).toBe(false)
    expect(player(state, "p2").jailTurns).toBe(0)
    expect(logKeys(state)).toContain("log.eventJailbreak")
  })

  it("only spawns host-allowed kinds", () => {
    let state = newGame(2, 42, { events: true, eventKinds: ["windfall"] })
    for (let i = 0; i < 200; i++) {
      state = gameReducer(state, { type: "FORCE_END_TURN" })
      expect(state.activeEvent ?? null).toBeNull() // windfall is instant
    }
    const eventKeys = logKeys(state).filter((k) => k.startsWith("log.event"))
    expect(eventKeys.length).toBeGreaterThan(0)
    expect(new Set(eventKeys)).toEqual(new Set(["log.eventWindfall"]))
  })

  it("spawns nothing when every kind is deselected", () => {
    let state = newGame(2, 42, { events: true, eventKinds: [] })
    for (let i = 0; i < 100; i++) {
      state = gameReducer(state, { type: "FORCE_END_TURN" })
    }
    expect(state.activeEvent ?? null).toBeNull()
    expect(logKeys(state).some((k) => k.startsWith("log.event"))).toBe(false)
  })

  it("scales the cooldown with the chosen frequency", () => {
    let state = newGame(2, 42, { events: true, eventFrequency: "rare" })
    state = withEvent(state, {
      kind: "bounty",
      tileId: 5,
      amount: 200,
      expiresAtTurn: 999,
    })
    state = gameReducer(withNextRoll(state, 2, 3), { type: "ROLL_DICE" })

    // rare = 2 full rounds of quiet (2 players → 4 turns).
    expect(state.eventCooldownUntil).toBe(state.turnCount + 4)
  })

  it("tax audit charges the richest-in-cash player 10%", () => {
    const state = newGame(2, 42, { events: true })
    state.players[0].balance = 2000

    applyInstantEvent(state, "taxAudit")

    expect(player(state, "p1").balance).toBe(1800)
    expect(player(state, "p2").balance).toBe(1500)
    const entry = state.log.find((e) => e.key === "log.eventTaxAudit")
    expect(entry?.params?.name).toBe("P1")
    expect(entry?.params?.amount).toBe(200)
  })

  it("doubles the GO payout while golden dice are active", () => {
    let state = newGame(2, 42, { events: true })
    state.players[0].position = 38
    state = withEvent(state, {
      kind: "goldenDice",
      tileId: null,
      amount: 0,
      expiresAtTurn: 999,
    })
    state = gameReducer(withNextRoll(state, 1, 2), { type: "ROLL_DICE" })

    expect(player(state, "p1").balance).toBe(1500 + 400)
    const passGo = state.log.find((e) => e.key === "log.passGo")
    expect(passGo?.params?.amount).toBe(400)
  })

  it("suspends rent while a rent freeze is active", () => {
    let state = newGame(2, 42, { events: true })
    state.tiles[5].ownerId = "p2" // Reading Railroad, rent $25
    state = withEvent(state, {
      kind: "rentFreeze",
      tileId: null,
      amount: 0,
      expiresAtTurn: 999,
    })
    state = gameReducer(withNextRoll(state, 2, 3), { type: "ROLL_DICE" })

    expect(player(state, "p1").balance).toBe(1500)
    expect(player(state, "p2").balance).toBe(1500)
    expect(logKeys(state)).toContain("log.rentFrozen")
    expect(logKeys(state)).not.toContain("log.rent")
  })
})
