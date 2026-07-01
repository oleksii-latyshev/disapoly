# Disapoly — Architecture

A 2D, browser-based take on Monopoly for playing with friends — no sign-up. One
person creates a room and shares a link; others join, pick a nickname, and play.
Game state is in-memory only (no database).

This document reflects the **current implementation**. For a step-by-step
history see the git log; for how to run/deploy see [README.md](README.md).

---

## 1. Overview

- **Two ways to play:** online (real-time, across devices via a link) and
  hot-seat (everyone on one device, no server).
- **No accounts** — identity is a persisted `playerId` + a nickname per room.
- **Session-only** — a match lives only while it's in progress; nothing is
  stored after it ends.
- **Full classic rules** — 40-tile board, dice/doubles, buying, rent, monopolies
  + houses/hotels, mortgage, jail, Chance/Community Chest cards, trading,
  bankruptcy, win.

---

## 2. Tech stack

| Layer | Tech |
|-------|------|
| UI | **React 19** + **Vite** + **TypeScript** |
| Styling | **Tailwind CSS 4**, **shadcn + Base UI** components |
| Animation | **Motion** (token movement, dice) |
| Charts | **Recharts** (net-worth chart, lazy-loaded) |
| Icons | **lucide-react** |
| Realtime server | **Cloudflare Durable Object** via **`partyserver`**, client via **`partysocket`** |
| Sound | **Web Audio API** (synthesized, no assets) |
| Deploy | Cloudflare **Workers** (server) + **Pages** (client), GitHub Actions |

---

## 3. Architecture

Three layers, cleanly separated:

```
UI (React) ── components render state, dispatch intent actions
   │
Sync ─────── online: WebSocket to the Durable Object; hot-seat: local useReducer
   │
Game core ── pure (state, action) => state reducer; no React, no I/O
```

### 3.1. Game core (`src/game/`) — pure and portable

The rules are a pure, JSON-serializable model plus a reducer. **No React, no
network, no `@/` alias** — so the exact same code runs in the browser and inside
the Cloudflare Worker.

- `types.ts` — `GameState`, `Player`, `GameAction`, log/card/trade types.
- `board.config.ts` — the declarative 40-tile board (prices, rent tables, groups)
  and constants (`GO_PAYOUT`, `JAIL_FINE`, …). Single source of truth; the rules
  contain no magic numbers.
- `cards.ts` — Chance / Community Chest decks as `{ id, effect }` (text is
  localized on the client via `card.<id>`).
- `rng.ts` — seedable PRNG (`mulberry32`) + `shuffle`. All randomness flows
  through `rngSeed` so results are deterministic and desync-free.
- `state.ts` — `createInitialState` + pure selectors (`netWorth`, `rentFor`,
  `hasMonopoly`, `canBuildHouse`, `isTradeValid`, `tradableTiles`, …).
- `reducer.ts` — `gameReducer(state, action)`. Validates each action against the
  current phase/rules and applies it atomically.
- `room.ts` — the multiplayer wrapper (see §3.3).

**`GameState`** (abridged):

```ts
type GameState = {
  status: "playing" | "finished"
  players: Player[]              // Player: id, nickname, color, balance,
                                 //   position, inJail, jailTurns,
                                 //   getOutOfJailCards, isBankrupt
  tiles: TileState[]             // owner, houses (0–5), mortgaged — per tile id
  currentPlayerIndex: number
  phase: "awaiting-roll" | "awaiting-buy" | "awaiting-end"
  dice: [number, number] | null
  doublesCount: number
  pendingPurchase: number | null
  rngSeed: number
  chance: DeckState; chest: DeckState   // { order, pos }
  lastCard: DrawnCard | null
  pendingTrade: TradeOffer | null
  turnCount: number
  history: HistoryPoint[]        // net-worth snapshot per turn (chart)
  log: LogEntry[]                // structured events { key, params }
  nextLogId: number
  winnerId: string | null
}
```

A **turn is a small state machine** (`phase`): `awaiting-roll → (resolve tile:
buy/rent/card/tax/jail) → awaiting-buy? → awaiting-end`. Doubles grant another
roll (except from jail / when sent to jail); three doubles → jail.

### 3.2. UI (`src/components/`, `src/hooks/`)

- In-game components (`components/game/`) take `state` + a `send(action)` and are
  shared by both modes: `GameBoard`, `TurnControls`, `ManagePanel`, `TradePanel`,
  `CardBanner`, `PlayersList`, `GameLog`, `GameResults`, `StatsButton`, …
- Online screens (`components/online/`): `HomeScreen`, `NicknamePrompt`,
  `LobbyScreen`, `RoomScreen`, `NetworkGame`.
- Hot-seat (`GameScreen`) drives the reducer with a local `useReducer`
  (`useGame`); online (`NetworkGame`) sends intents over the socket.
- Cross-cutting: `i18n.tsx` (en/ru), `board-theme.tsx` (Classic/Minimal/Neon),
  `SoundProvider`, settings dialog (`SettingsButton`, bottom-left).

### 3.3. Networking — authoritative Durable Object

The server is the **single source of truth** ("Option B": a thin authoritative
relay, no database).

- **`src/game/room.ts`** — `RoomState { roomId, phase: "lobby" | "in-game",
  members: RoomMember[], game: GameState | null }` and the pure
  `applyClientMessage(state, msg, senderId)` authority reducer.
- **`party/server.ts`** — a `partyserver` `Server` (a Cloudflare Durable Object).
  One instance per room id. It holds `RoomState` in memory, feeds validated
  client messages into `applyClientMessage`, and broadcasts the whole state.
- Clients (`src/hooks/useRoom.ts` over `partysocket`) send **intents**, never
  state: `join` / `start` / `action` / `reset` / `skip`.

**Authority rules enforced server-side:**

- Turn-gated actions (roll/buy/build/…) are accepted only from the player whose
  turn it is.
- Trades are allowed **out of turn**; the server **stamps the sender's id** into
  the trade action so it can't be spoofed.
- A **disconnected current player's turn can be skipped** by any connected member
  (`skip` → internal `FORCE_END_TURN`). `FORCE_END_TURN` is never accepted from a
  client directly.
- Host-only: `start`, `reset`.

**Identity & reconnect:** `playerId` (localStorage) + nickname. A refreshed or
dropped tab rejoins the same member by id and resumes.

---

## 4. Deployment

Server and client deploy separately, both on Cloudflare's **free** tier.

- **Server** → Cloudflare Worker (Durable Object). `wrangler.jsonc` binds the
  `Game` DO class; it's declared as a `new_sqlite_classes` migration because the
  free plan requires the SQLite-backed DO backend (we don't use its storage yet).
- **Client** → Cloudflare Pages (any static host works). The worker host is baked
  in at build time via `VITE_PARTYKIT_HOST`.
- **CI:** pushing to `master` runs `.github/workflows/deploy.yml` →
  `bun run deploy:all` (worker → client build → Pages). Needs repo secrets
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

> **Why self-hosted Cloudflare, not PartyKit's cloud?** PartyKit's hosted
> platform (`*.partykit.dev`) is in maintenance after the Cloudflare acquisition
> and its shared zone hit the 10k-custom-domains limit, so deploys fail there.
> `partyserver` is the same model on *your own* Cloudflare account — no shared
> limits, free DO tier, and the `partysocket` client is unchanged.

> **Cost:** $0 for our scale. Free Workers = 100k requests/day; a few friends are
> a fraction of a percent. In-memory room state means no storage billing.

See [README.md](README.md) for exact commands.

---

## 5. Implemented features

**Rules (all in the shared reducer):**

- ✅ 40-tile board, 2×d6 dice, doubles (extra turn / 3× → jail), GO payout.
- ✅ Buying, rent (monopoly ×2, railroad by count, utility by dice), taxes.
- ✅ Monopolies + houses/hotels with the even-building rule; sell buildings.
- ✅ Mortgage / unmortgage; automatic liquidation → bankruptcy.
- ✅ Jail: roll for doubles (no extra turn), pay the fine, or use a card; forced
  fine on the 3rd failed attempt.
- ✅ Chance / Community Chest — seeded decks, declarative effects.
- ✅ Player-to-player trading (properties + cash + jail cards), two-phase with
  re-validation at apply time, allowed out of turn.
- ✅ Win / final standings.

**Online:**

- ✅ Lobby, link sharing, turn order across devices; authoritative DO server.
- ✅ Reconnect by `playerId`; skip a disconnected player's turn.
- ✅ "Your turn" + "trade offer" notifications — a chime (distinct ding for an
  offer addressed to you) plus a flashing tab title when backgrounded
  (`useTabAlert`, coordinated so concurrent alerts don't fight over the title).
  Incoming trade offers also raise a center callout and highlight the panel.

**Polish / QoL:**

- ✅ Board themes (Classic / Minimal / Neon), tile icons, house badges, monopoly
  highlight, click-a-tile-for-rent-details.
- ✅ Animated token movement + 3D dice (Motion), respects
  `prefers-reduced-motion`. Token travel is paced to stay legible (per-tile hops
  + a landing pop), so jumps to jail / card destinations read clearly.
- ✅ **Visual juice** — center-screen event callouts for pivotal moments (bought
  / rent / tax / jail / bankrupt, derived from the log), a slot-machine card
  reveal that rattles through effects before landing, floating +$/−$ deltas over
  tokens, and win confetti. Bundled in `GameEvents` + `TokenLayer`; shared by
  both play modes and gated by reduced motion.
- ✅ Procedural sound effects (Web Audio); mute toggle.
- ✅ Net-worth chart (Stats dialog) + end-game results overlay.
- ✅ i18n (en/ru) across UI, game log (structured events), and cards.
- ✅ Hot-seat mode preserved as an offline option.
- ✅ Onboarding: a "How to play" rules reference (bottom-left, alongside
  Settings) and a decision-support buy prompt (`purchasePreview`) showing the
  rent you'd earn and set/collection progress before you buy.

---

## 6. Design principles & invariants

- **Single source of truth.** Clients never mutate state directly — only send
  intents; the authority (reducer) validates and applies. Removes desync bugs.
- **Rules are pure & deterministic.** Same state + action ⇒ same result. All RNG
  goes through `rngSeed`. This is why the core can run on both client and server.
- **Reason by tile `id`/`type`, not screen coordinates** — logic is fully
  decoupled from rendering.
- **The log is data, not strings.** Entries are `{ key, params }` and cards are
  ids; the client localizes them. Tile names stay as proper nouns.
- **No database.** Room state is in the DO's memory; when the room empties, it's
  gone. localStorage only holds `playerId`, nickname, and UI settings — never
  shared game state (it can't sync between users).

---

## 7. Backlog / ideas

Not yet done — rough priority order:

- **Auction on declined purchase** (classic rule; currently a declined tile stays
  with the bank).
- **Room persistence** — mirror `RoomState` into the DO's SQLite storage so a
  match survives a worker restart/eviction.
- **Auto-skip timeout** for a disconnected player via a DO alarm (currently a
  manual skip button).
- **House/hotel scarcity** (32/12 bank) for full authenticity.
- **Player cap > 8** would need more token colors.
- **Delta sync** — broadcast diffs instead of the whole state once matches grow
  long (currently full-state broadcast; fine at this scale).
- Spectators / late join, reactions/mini-chat, avatars.
