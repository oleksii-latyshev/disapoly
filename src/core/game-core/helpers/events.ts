// Surprise events (settings.events). Three shapes: tile events (bounty,
// rabbit) wait on the board until claimed; round modifiers (goldenDice,
// rentFreeze, rentSurge) apply for one full round; instant events fire at the
// end of a turn. Deterministic like the rest of the core: all randomness
// flows through `rngSeed`.

import { returnBuilding } from "./buildings"
import { log } from "./log"
import { nextRandom } from "./rng"
import { activePlayers, boardOf, boardSizeOf, tileDef } from "./selectors"
import type {
  BoardEvent,
  BoardEventKind,
  EventFrequency,
  GameState,
  Player,
} from "../types"

const AUDIT_MIN_CASH = 200

const KIND_WEIGHTS: [BoardEventKind, number][] = [
  ["bounty", 0.2],
  ["rabbit", 0.15],
  ["goldenDice", 0.1],
  ["rentFreeze", 0.1],
  ["rentSurge", 0.1],
  ["earthquake", 0.1],
  ["windfall", 0.1],
  ["jailbreak", 0.05],
  ["taxAudit", 0.1],
]

/** Every event kind, in display order (the lobby's per-kind toggles). */
export const ALL_EVENT_KINDS: readonly BoardEventKind[] = KIND_WEIGHTS.map(
  ([kind]) => kind
)

// "normal" paces events to roughly one every 8–11 turns (~5 minutes).
const FREQUENCY: Record<
  EventFrequency,
  { chance: number; cooldownRounds: number }
> = {
  rare: { chance: 0.15, cooldownRounds: 2 },
  normal: { chance: 0.25, cooldownRounds: 1 },
  frequent: { chance: 0.45, cooldownRounds: 0.5 },
}

function frequencyOf(state: GameState): {
  chance: number
  cooldownRounds: number
} {
  return FREQUENCY[state.settings?.eventFrequency ?? "normal"]
}

function allowedKinds(state: GameState): readonly BoardEventKind[] {
  return state.settings?.eventKinds ?? ALL_EVENT_KINDS
}

/** The live event, tolerating states persisted before events existed. */
export function activeEvent(state: GameState): BoardEvent | null {
  return state.activeEvent ?? null
}

export function isRentFrozen(state: GameState): boolean {
  return activeEvent(state)?.kind === "rentFreeze"
}

export function rentMultiplier(state: GameState): number {
  return activeEvent(state)?.kind === "rentSurge" ? 2 : 1
}

export function goPayoutMultiplier(state: GameState): number {
  return activeEvent(state)?.kind === "goldenDice" ? 2 : 1
}

function draw(d: GameState): number {
  const next = nextRandom(d.rngSeed)
  d.rngSeed = next.seed
  return next.value
}

/** A random non-corner tile — corners host fixed mechanics, not prizes. */
function randomEventTile(d: GameState): number {
  const size = boardSizeOf(d)
  const quarter = size / 4
  for (;;) {
    const tile = Math.floor(draw(d) * size)
    if (tile % quarter !== 0) return tile
  }
}

function startCooldown(d: GameState): void {
  const rounds = frequencyOf(d).cooldownRounds
  d.eventCooldownUntil =
    d.turnCount + Math.max(1, Math.round(activePlayers(d).length * rounds))
}

/** End-of-turn upkeep: expire the live event, or let the rabbit hop onward.
 * Call after `turnCount` has been advanced. */
export function tickEvent(d: GameState): void {
  const event = activeEvent(d)
  if (!event) return
  if (d.turnCount >= event.expiresAtTurn) {
    d.activeEvent = null
    startCooldown(d)
    log(d, "log.eventEnded", { event: { t: `event.${event.kind}` } })
    return
  }
  if (event.kind === "rabbit" && event.tileId !== null) {
    const hop = 1 + Math.floor(draw(d) * 6)
    d.activeEvent = {
      ...event,
      tileId: (event.tileId + hop) % boardSizeOf(d),
    }
  }
}

function builtTileIds(d: GameState): number[] {
  return boardOf(d)
    .filter((def) => def.type === "street" && d.tiles[def.id].houses > 0)
    .map((def) => def.id)
}

function auditTarget(d: GameState): Player | null {
  let richest: Player | null = null
  for (const p of activePlayers(d)) {
    if (!richest || p.balance > richest.balance) richest = p
  }
  return richest && richest.balance >= AUDIT_MIN_CASH ? richest : null
}

/** Guards its own precondition — a kind whose moment hasn't come is a no-op. */
export function applyInstantEvent(d: GameState, kind: BoardEventKind): void {
  switch (kind) {
    case "earthquake": {
      const built = builtTileIds(d)
      if (built.length === 0) return
      const tileId = built[Math.floor(draw(d) * built.length)]
      returnBuilding(d, tileId)
      log(d, "log.eventEarthquake", { tile: tileDef(d, tileId).name })
      return
    }
    case "windfall": {
      const amount = 50 + Math.floor(draw(d) * 5) * 25
      for (const p of activePlayers(d)) p.balance += amount
      log(d, "log.eventWindfall", { amount })
      return
    }
    case "jailbreak": {
      const jailed = activePlayers(d).filter((p) => p.inJail)
      if (jailed.length === 0) return
      for (const p of jailed) {
        p.inJail = false
        p.jailTurns = 0
      }
      log(d, "log.eventJailbreak")
      return
    }
    case "taxAudit": {
      const target = auditTarget(d)
      if (!target) return
      const amount = Math.floor(target.balance * 0.1)
      target.balance -= amount
      log(d, "log.eventTaxAudit", { name: target.nickname, amount })
      return
    }
    default:
      return
  }
}

function isSpawnable(d: GameState, kind: BoardEventKind): boolean {
  if (kind === "earthquake") return builtTileIds(d).length > 0
  if (kind === "jailbreak") return activePlayers(d).some((p) => p.inJail)
  if (kind === "taxAudit") return auditTarget(d) !== null
  return true
}

/**
 * Maybe spawn a fresh event at the end of a turn: only with the setting on,
 * none live, and past the cooldown. The kind is drawn among the host-allowed
 * kinds whose moment has come, weights renormalized — disabling kinds never
 * wastes a spawn roll.
 */
export function maybeSpawnEvent(d: GameState): void {
  if (!d.settings?.events || activeEvent(d)) return
  const playersIn = activePlayers(d).length
  if (d.turnCount < (d.eventCooldownUntil ?? playersIn)) return

  const allowed = allowedKinds(d)
  const candidates = KIND_WEIGHTS.filter(
    ([kind]) => allowed.includes(kind) && isSpawnable(d, kind)
  )
  if (candidates.length === 0) return
  if (draw(d) >= frequencyOf(d).chance) return

  const total = candidates.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = draw(d) * total
  let kind: BoardEventKind = candidates[0][0]
  for (const [candidate, weight] of candidates) {
    roll -= weight
    if (roll < 0) {
      kind = candidate
      break
    }
  }

  if (kind === "bounty" || kind === "rabbit") {
    const tileId = randomEventTile(d)
    const amount = 100 + Math.floor(draw(d) * 4) * 50
    d.activeEvent = {
      kind,
      tileId,
      amount,
      expiresAtTurn: d.turnCount + playersIn * 2,
    }
    if (kind === "bounty") {
      log(d, "log.eventBounty", { amount, tile: tileDef(d, tileId).name })
    } else {
      log(d, "log.eventRabbit", { amount })
    }
  } else if (
    kind === "goldenDice" ||
    kind === "rentFreeze" ||
    kind === "rentSurge"
  ) {
    d.activeEvent = {
      kind,
      tileId: null,
      amount: 0,
      expiresAtTurn: d.turnCount + playersIn,
    }
    log(
      d,
      kind === "goldenDice"
        ? "log.eventGoldenDice"
        : kind === "rentFreeze"
          ? "log.eventRentFreeze"
          : "log.eventRentSurge"
    )
  } else {
    applyInstantEvent(d, kind)
    startCooldown(d)
  }
}

/** Claim the event under `player`'s feet. Runs before the tile's own effect,
 * so a bounty can help cover the rent waiting on that same tile. */
export function claimEventAt(d: GameState, player: Player): void {
  const event = activeEvent(d)
  if (!event || event.tileId === null || event.tileId !== player.position)
    return
  player.balance += event.amount
  d.activeEvent = null
  startCooldown(d)
  log(
    d,
    event.kind === "rabbit"
      ? "log.eventRabbitCaught"
      : "log.eventBountyClaimed",
    { name: player.nickname, amount: event.amount }
  )
}
