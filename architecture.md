# Disapoly — Architecture

A 2D, browser-based take on Monopoly for playing with friends — no sign-up. One
person creates a room and shares a link; others join, pick a nickname, and play.
Game state lives in the room's Durable Object (persisted to its own SQLite
storage) — no external database.

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
| Animation | **Motion** (board tilt, tokens, dice, card reveal, banners) |
| Charts | **Recharts** (net-worth chart, lazy-loaded) |
| Icons | **lucide-react** |
| Realtime server | **Cloudflare Durable Object** via **`partyserver`**, client via **`partysocket`** |
| Sound | **Web Audio API** (synthesized, no assets) |
| Tests | **Vitest** — unit tests for the pure game core (`src/core/game-core/__tests__/`) |
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

### 3.1. Game core (`src/core/game-core/`) — pure and portable

The rules are a pure, JSON-serializable model plus a reducer. **No React, no
network, no `@/` alias** — so the exact same code runs in the browser and inside
the Cloudflare Worker. (Folder conventions: [CODE_RULES.md](CODE_RULES.md).)

- `types.ts` — `GameState`, `Player`, `GameAction`, log/card/trade types.
- `constants/board.ts` — the declarative boards and constants (`GO_PAYOUT`,
  `JAIL_FINE`, …). Two boards exist (`BOARDS`): the **classic 40-tile** board
  and a host-selectable **large 48-tile** board (13×13, two extra street
  groups — teal & violet — plus a third dark-blue street: 10 monopolizable
  groups for 6–8 players, with a proportionally larger building supply).
  `settings.board` picks one per match; everything (layout, movement, cards,
  selectors) derives from `boardOf(state)` — no magic numbers in the rules.
- `constants/cards.ts` — Chance / Community Chest decks as `{ id, effect }`
  (text is localized on the client via `card.<id>`). Movement cards name their
  destination (`target: "boardwalk"`, …) so the same deck resolves correctly
  on any board size.
- `helpers/rng.ts` — seedable PRNG (`mulberry32`) + `shuffle`. All randomness
  flows through `rngSeed` so results are deterministic and desync-free.
- `state.ts` — `createInitialState`; pure queries live in
  `helpers/selectors.ts` (`netWorth`, `rentFor`, `hasMonopoly`, …) and
  `helpers/validators.ts` (`canBuildHouse`, `isTradeValid`, `tradableTiles`, …).
- `reducer/` — `gameReducer(state, action)`: a dispatcher (`index.ts`) that
  validates each action against the current phase, plus one file per domain
  (`turn.ts`, `movement.ts`, `payments.ts`, `auction.ts`, `trades.ts`,
  `property.ts`, `bankruptcy.ts`).
- `room.ts` — the multiplayer wrapper (see §3.3).

**`GameState`** (abridged):

```ts
type GameState = {
  status: "playing" | "finished"
  settings: GameSettings         // { payMode, orderRoll, board, events } — host-chosen
  players: Player[]              // Player: id, nickname, color, balance,
                                 //   position, inJail, jailTurns,
                                 //   getOutOfJailCards, isBankrupt
  tiles: TileState[]             // owner, houses (0–5), mortgaged — per tile id
  currentPlayerIndex: number
  phase: "awaiting-roll" | "awaiting-buy" | "awaiting-pay" | "awaiting-end"
  dice: [number, number] | null
  doublesCount: number
  pendingPurchase: number | null
  pendingDebt: PendingDebt | null // charge awaiting PAY_DEBT (normal pay mode)
  rngSeed: number
  chance: DeckState; chest: DeckState   // { order, pos }
  lastCard: DrawnCard | null
  activeEvent?: BoardEvent | null // live surprise event (settings.events)
  pendingTrades: TradeOffer[]    // open offers (queue; ≤1 per from→to pair)
  nextTradeId: number
  turnCount: number
  history: HistoryPoint[]        // net-worth snapshot per turn (chart)
  log: LogEntry[]                // structured events { key, params }
  nextLogId: number
  winnerId: string | null
}
```

A **turn is a small state machine** (`phase`): `awaiting-roll → (resolve tile:
buy/rent/card/tax/jail) → awaiting-buy? → awaiting-pay? → awaiting-end`.
Doubles grant another roll (except from jail / when sent to jail); three
doubles → jail.

**Pay modes** (host setting at game creation): in `turbo` (default, classic
behavior) rent/taxes/card charges are deducted the moment they're incurred; in
`normal` a charge against the acting player pauses the turn in `awaiting-pay`
until they confirm with `PAY_DEBT` — and **they raise the cash themselves**:
the payment is only accepted once their balance covers it (sell buildings,
mortgage, trade meanwhile — `maxRaisable` decides whether the debt is payable
at all; a hopeless debt liquidates/bankrupts instantly since no choice
exists). A force-ended turn collects the pending debt automatically (turbo
style), so skipping a disconnected player never dodges rent.

**Opening roll-off** (`settings.orderRoll`, host toggle): the match opens in an
`order-roll` phase — every player rolls once (`orderRolls` in state), the
highest starts and play proceeds clockwise from them; ties re-roll among the
tied. A disconnected player's opening roll is made for them by the auto-skip
alarm (`FORCE_END_TURN` rolls instead of skipping during this phase).

**Emoji avatars:** every player has an `emoji` (from `PLAYER_EMOJIS`),
auto-assigned on join and changeable in the lobby / hot-seat setup (uniqueness
enforced by the room; the preference persists in localStorage). Shown on the
board token and in the players list.

**Leaving the game:** `DECLARE_BANKRUPTCY` (any player, self-stamped by the
server) and the server-only `FORCE_BANKRUPT` retire a player outside the normal
insolvency path: any pending debt is settled first (classically, to the
creditor), then their remaining properties return to the bank *unowned and
unmortgaged* — up for grabs again.

### 3.2. UI (`src/features/`, `src/core/`)

- Feature slices (see [CODE_RULES.md](CODE_RULES.md)) take `state` + a
  `send(action)` and are shared by both modes: `features/board` (tiles,
  tokens, dice), `features/game` (turn controls, panels, log, results),
  `features/trade`, `features/auction`, `features/events`.
- Online screens (`features/online`): `HomeScreen`, `NicknamePrompt`,
  `LobbyScreen`, `RoomScreen`, `NetworkGame`.
- Hot-seat (`GameScreen`) drives the reducer with a local `useReducer`
  (`useGame`); online (`NetworkGame`) sends intents over the socket.
- Cross-cutting core: `core/i18n` (en/ru), `core/sound`,
  `core/theme`, `core/board` (tile geometry/travel plans), and the
  board theme (`features/board`, Classic/Minimal/Neon).

### 3.3. Networking — authoritative Durable Object

The server is the **single source of truth** ("Option B": a thin authoritative
relay, no database).

- **`src/core/game-core/room.ts`** — `RoomState { roomId, phase: "lobby" | "in-game",
  members: RoomMember[], game: GameState | null }` and the pure
  `applyClientMessage(state, msg, senderId)` authority reducer.
- **`server/`** — a `partyserver` `Server` (a Cloudflare Durable Object).
  One instance per room id. It holds `RoomState` in memory, feeds validated
  client messages into `applyClientMessage`, and broadcasts the whole state.
  `index.ts` is the worker entry, `disapoly-server.ts` the DO class (socket
  lifecycle + storage only); alarm deadlines, restore-after-restart and
  ephemeral relays are pure, unit-tested helpers in `server/helpers/`.
- Clients (`src/core/network/hooks/useRoom.ts` over `partysocket`) send **intents**, never
  state: `join` / `start` / `action` / `reset` / `skip` / `rename` / `avatar`
  / `kick`.

**Authority rules enforced server-side:**

- Turn-gated actions (roll/buy/build/…) are accepted only from the player whose
  turn it is.
- Trades, bids and `DECLARE_BANKRUPTCY` are allowed **out of turn**; the server
  **stamps the sender's id** into the action so it can't be spoofed.
- A **disconnected current player's turn can be skipped** by any connected member
  (`skip` → internal `FORCE_END_TURN`). `FORCE_END_TURN` / `FORCE_BANKRUPT` are
  never accepted from a client directly.
- Host-only: `start` (with the match settings), `reset`, and `kick` (lobby
  only; kicked ids are barred from rejoining via `kickedIds`, their sockets are
  closed and the client shows a "removed by host" notice).
- `rename` updates the sender's member nickname and, mid-match, their in-game
  player; a reconnect `join` re-syncs both the same way.

**Identity & reconnect:** `playerId` (localStorage) + nickname. A refreshed or
dropped tab rejoins the same member by id and resumes.

---

## 4. Deployment

Server and client deploy separately, both on Cloudflare's **free** tier.

- **Server** → Cloudflare Worker (Durable Object). `wrangler.jsonc` binds the
  `Game` DO class; it's declared as a `new_sqlite_classes` migration (required on
  the free plan), and we use that SQLite-backed storage to persist room state.
- **Client** → Cloudflare Pages (any static host works). The worker host is baked
  in at build time via `VITE_PARTYKIT_HOST`.
- **CI/CD:** `.github/workflows/deploy.yml` runs a `check` job (typecheck →
  lint → **Vitest** game-core tests) on every push and pull request; on a
  `master` push a `deploy` job then runs `bun run deploy:all` (worker → client
  build → Pages), but **only if the checks pass** — a broken rule can't ship.
  Needs repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

> **Why self-hosted Cloudflare, not PartyKit's cloud?** PartyKit's hosted
> platform (`*.partykit.dev`) is in maintenance after the Cloudflare acquisition
> and its shared zone hit the 10k-custom-domains limit, so deploys fail there.
> `partyserver` is the same model on *your own* Cloudflare account — no shared
> limits, free DO tier, and the `partysocket` client is unchanged.

> **Cost:** $0 for our scale. Free Workers = 100k requests/day; a few friends are
> a fraction of a percent. Persisted room state is a few KB of DO storage per
> active room — negligible on the free tier.

See [README.md](README.md) for exact commands.

---

## 5. Implemented features

**Rules (all in the shared reducer):**

- ✅ 40-tile board, 2×d6 dice, doubles (extra turn / 3× → jail), GO payout.
- ✅ Buying, rent (monopoly ×2, railroad by count, utility by dice), taxes.
- ✅ Auction on a declined/unaffordable tile — sequential bidding among all
  players (`auction` phase; `PLACE_BID`/`PASS_BID`), high bidder wins or the
  bank keeps it if nobody bids. Bids are server-stamped (spoof-proof).
- ✅ Monopolies + houses/hotels with the even-building rule; sell buildings.
- ✅ Finite building supply (32 houses / 12 hotels in `bank`): you can only build
  when the bank stocks the piece, a hotel returns its 4 houses to the bank, and
  sold/reclaimed buildings flow back — enabling the classic "house shortage"
  tactic. (Selling a hotel is softened if the bank is short on houses so
  liquidation never deadlocks.)
- ✅ Mortgage / unmortgage; automatic liquidation → bankruptcy.
- ✅ Jail: roll for doubles (no extra turn), pay the fine, or use a card; forced
  fine on the 3rd failed attempt.
- ✅ Chance / Community Chest — seeded decks, declarative effects.
- ✅ Player-to-player trading (properties + cash + jail cards), two-phase with
  re-validation at apply time, allowed out of turn. **Several offers can be
  pending at once** (a queue; at most one open offer per from→to pair, each
  answered by id), and an incoming offer has a **counter-offer** button that
  opens the builder prefilled with the mirrored bundles — sending it declines
  the original.
- ✅ Board choice per match (`settings.board`): classic 40 tiles, or a
  **large 48-tile board** with the teal + violet groups (10 street groups) so
  6–8 players can all reach a monopoly; host-chosen online, also in hot-seat
  setup.
- ✅ Pay modes: turbo (instant deduction) or normal (debts confirmed with a
  "Pay" step — trade/mortgage first); host-chosen per match, also available in
  hot-seat setup.
- ✅ **Surprise events** (`settings.events`, host/hot-seat toggle, off by
  default): seeded, temporary events spawn from `events.ts` (at most one live
  at a time) in three shapes —
  - *tile events*: a **bounty** on a random tile (first to land collects
    $100–250) and a **lucky rabbit** that hops 1–6 tiles at the end of every
    turn until caught (both expire after two uncaught rounds);
  - *round modifiers*: **golden dice** (double GO payout), **rent freeze**
    (no rent), **boom day** (all rent ×2) — each lasts one full round;
  - *instant events*: an **earthquake** (one random building collapses back
    to the bank), **money rain** (everyone collects $50–150), a **jailbreak**
    (everyone in jail walks free), and a **tax audit** (the richest-in-cash
    player pays 10% to the bank). Kinds whose moment hasn't come (nothing
    built, nobody jailed) fall back to a bounty.

  The host also picks **which kinds may spawn** (`settings.eventKinds`,
  per-kind chips; unset = all, empty = none) and the **frequency**
  (`settings.eventFrequency`: rare / normal / frequent — scaling both the
  per-turn spawn chance and the post-event cooldown). Disabled or
  currently-impossible kinds are simply left out of the weighted draw.

  Pacing (normal): one full round of cooldown after each event, then a
  25%-per-turn spawn roll — roughly one event every 8–11 turns (~5 minutes).
  A live **boom day** is also reflected in the UI's rent numbers (tile value
  tags and the details dialog show the doubled "rent now"). Everything
  flows through the seeded PRNG and the structured log; the UI shows a board
  marker + a golden status pill, and each event has its own short animation
  (`EventFx.tsx`, log-driven like the callouts): a board shake, money rain,
  a lock popping off the jail corner, an "AUDIT" stamp, a heat-glow pulse —
  all skipped under `prefers-reduced-motion`.
- ✅ Voluntary bankruptcy — a "declare bankruptcy" button (with confirmation)
  lets a player leave; their properties return to the bank unclaimed.
- ✅ Win / final standings.

**Online:**

- ✅ Lobby, link sharing, turn order across devices; authoritative DO server.
- ✅ Reconnect by `playerId`; skip a disconnected player's turn — manually, or
  automatically after a 30s grace period via a **DO alarm** (`autoSkipAt` in the
  room state drives a live countdown; `onAlarm` force-ends the absent turn).
  Auto-skip is gated on *someone still being present* (`shouldAutoSkip`): it
  never "plays itself" in an empty room.
- ✅ **5-minute absence limit** — a player disconnected for `AUTO_BANKRUPT_MS`
  while the match runs (and someone is still present) is force-bankrupted by
  the alarm: their properties return to the bank unowned, so the survivors keep
  a playable board. Each member's `disconnectedAt` drives the deadline;
  reconnecting clears it.
- ✅ Empty-room cleanup: if **everyone** disconnects mid-match the game pauses,
  and is **abandoned back to the lobby** after a 60s grace period. The single
  DO alarm serves all three duties (skip / auto-bankrupt / abandon) by arming
  for the earliest applicable deadline; `onAlarm` runs every duty whose
  deadline has passed.
- ✅ Lobby management — host kicks members (with rejoin bar), anyone can edit
  their nickname and cycle their emoji avatar in the lobby (both persisted to
  localStorage and synced into a running game), host picks the pay mode
  (turbo/normal) and the opening roll-off before starting.
- ✅ Emoji reactions — an ephemeral `reaction` message relayed by the server
  (never stored in state) that floats over the reacting player's token.
- ✅ Per-player connection quality — each client measures its round-trip
  (`ping`/`pong`) and shares it (`latency`, relayed like reactions, not stored);
  the players list shows a signal dot + ms, and a "slow connection" notice flags
  a laggy current player so everyone sees why the turn is slow to advance.
- ✅ Room persistence — the whole `RoomState` is mirrored into the DO's own
  SQLite storage on each change and reloaded on cold start, so a match survives a
  worker restart / deploy / eviction (reconnecting members resume where they
  left off). The blob is dropped once a match is abandoned.
- ✅ "Your turn" + "trade offer" notifications — a chime (distinct ding for an
  offer addressed to you) plus a flashing tab title when backgrounded
  (`useTabAlert`, coordinated so concurrent alerts don't fight over the title).
  Incoming trade offers also raise a center callout and highlight the panel.

**Polish / QoL:**

- ✅ Board themes (Classic / Minimal / Neon), house badges, monopoly highlight,
  click-a-tile-for-rent-details (with a highlighted **"rent now"** row showing
  what a visitor would actually owe).
- ✅ **Icon-dominant tiles** — every location has its own vector emblem
  (`tile-visuals.tsx`, lucide icons drawn in code, no image assets), a value
  tag pinned right under the name (price while unowned → the *current rent*
  in the owner's color once bought), and the whole tile washes in the owner's
  color — ownership and cost read straight off the board. Street names hide on
  small boards (the emblem + details dialog identify the tile). Group palettes
  put brown/orange/yellow on a dark→light lightness ladder for low color
  vision.
- ✅ **Per-side tile orientation** — the group color band always faces the
  board's *outer* edge on all four sides; house badges hug the outer edge too.
- ✅ **Trade legibility** — an incoming offer shows green "you receive" / red
  "you give" boxes from the viewer's perspective, and tiles that change hands
  (trade or bankruptcy transfer) pulse gold on the board for ~2s. While an
  offer is *pending*, its tiles pulse on the board itself — green for what the
  viewer would gain, red for what they'd give, gold for spectators (a static
  ring under reduced motion).
- ✅ **Social/meta polish** — a Neon-theme favicon + apple-touch icon (midnight
  navy, glowing cyan ring/gem, neon corner tiles) and full OpenGraph/Twitter
  previews with a generated 1200×630 card in the same neon style
  (`public/og.jpg`, rendered from an SVG design).
- ✅ **Premium motion pass** (every effect below is gated by
  `prefers-reduced-motion`):
  - 3D board tilt — the board tilts a few degrees toward the mouse in
    perspective, with a depth shadow that shifts against the tilt (`BoardTilt`;
    mouse-only, touch never tilts).
  - Emoji-first 3D tokens — the avatar is the piece, standing on a small
    color-coded pedestal (a sphere-shaded pawn with the initial when no emoji
    is set), with a ground shadow that detaches as the piece arcs. Travel is
    paced to stay legible (per-tile hop arcs + a landing pop), so jumps to
    jail / card destinations read clearly.
  - Dice: 3D cube tumble plus a throw arc — a landing bounce with a floor
    shadow that contracts mid-air.
  - Card reveal flips in with 3D perspective and gets a shine sweep when the
    result settles; house/hotel badges drop onto the tile with a spring bounce
    and a construction dust puff; the ownership bar sweeps in on purchase.
  - Turn-handoff banner (`TurnBanner`) — a ribbon in the next player's color
    expands across the screen while their name slides through.
  - Ambient drifting background gradients, a periodic logo shine, and rolling
    money counters with green/red gain-loss flashes in the players list.
- ✅ **Visual juice** — event callouts for pivotal moments (bought / rent / tax
  / jail / bankrupt, derived from the log) anchored inside the board above the
  dice (`EventAnnouncer`, rendered by `GameBoard`), a slot-machine card reveal
  that rattles through effects before landing, floating +$/−$ deltas over
  tokens, and win confetti. Shared by both play modes.
- ✅ **Landing-synced feedback** — effects caused by landing on a tile (card
  reveal, event callouts, card/jail sounds, money deltas) wait for the token's
  travel animation via a shared `travelPlan` helper (`src/core/board`), so the
  outcome isn't revealed before the piece arrives. A **movement card** (e.g.
  "Advance to GO") and a roll onto **Go To Jail** animate in two legs: the
  token first visibly lands on the tile the roll hit, pauses (card reveal /
  a dramatic beat), then travels on to the destination (`travelStopover` in
  `src/core/board`). Turn buttons
  (roll/buy/end/pay) are disabled until the travel settles
  (`useTravelSettled`), so a turn can't be ended while a piece is still
  flying. Stationary events (buy, trade, auction) stay instant, and reduced
  motion drops the delays entirely.
- ✅ Procedural sound effects (Web Audio) — every voice feeds a shared bus with
  a synthesized room reverb (generated impulse response) and a gentle
  compressor; per-event sound design: randomized dice rattle, cash
  "cha-ching", hammer knocks, card swish, bell-partial chimes, a metallic jail
  clang, and a layered win fanfare. Mute toggle.
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
- **No external database.** Room state lives in the DO's memory and is mirrored
  into that same DO's SQLite storage (reloaded on cold start); it's dropped when
  a match is abandoned. localStorage only holds `playerId`, nickname, and UI
  settings — never shared game state (it can't sync between users).

---

## 7. Backlog / ideas

Not yet done — rough priority order:

- **More tests for the multiplayer authority.** `room.ts` now has coverage for
  settings, rename, kick, action stamping and the disconnect auto-bankrupt
  (`room.test.ts`), but turn gating, trade stamping and skip/abandon are still
  untested.
- **Missing classic card nuances.** The Chance deck has no "advance to the
  nearest Railroad (pay double rent)" / "nearest Utility (pay 10× dice)" cards
  — only fixed-destination moves. (A movement card still resolves in a single
  state update; the client now *animates* it as two legs with a stop-over on
  the deck tile, but the reducer-level split is still open.)
- **Player cap > 8** — emoji avatars exist (16 in `PLAYER_EMOJIS`), but seats
  are still capped by the fixed 8-color token palette; decoupling color from
  identity would unlock more players.
- **More house-rule settings at game creation** — pay mode and the opening
  roll-off exist; still open: starting cash, GO payout, auction on/off, Free
  Parking jackpot, and an online **turn timer** (the 30s disconnect auto-skip
  exists, but a present-but-slow player can stall forever — and in normal pay
  mode a debtor who *can* pay may sit on the debt indefinitely).
- **Bot players** — fill empty seats or play solo; the pure reducer makes a
  heuristic AI cheap to run on either side of the wire.
- **Spectators / late join, mini-chat.**
- **Delta sync** — broadcast diffs instead of the whole state once matches grow
  long (currently full-state broadcast; fine at this scale). The `log` is capped
  at 100 entries in state (`LOG_CAP`) so it no longer grows unbounded; `history`
  (net-worth chart) is still sent in full.
- **Sound volume slider** (currently mute-only).
