# Disapoly — Project Architecture

> A 2D take on "Monopoly" for playing with a group of friends (up to ~6 people).
> No registration, no game-history persistence. One person creates a room and shares a link — the rest join via that link, enter a nickname, and play.

---

## 1. Overview

**Disapoly** is a browser-based, turn-based board game inspired by "Monopoly".

Key properties:

- **Real-time multiplayer** — usually 6 players, fewer/more is allowed (recommended cap — 8).
- **No accounts** — identity is just a nickname within a single room.
- **Session-only** — game state lives only while a match is in progress. Nothing is stored on a server after it ends.
- **Link sharing** — the room creator gets a URL like `/room/<roomId>` and sends it to friends.

---

## 2. Technology Stack

### Current (already in the repository)

| Layer | Technology | Purpose |
|-------|------------|---------|
| UI framework | **React 19** | Components, UI state |
| Build / dev server | **Vite 8** | Bundling, HMR, build |
| Language | **TypeScript 6** | Type-safe game model |
| Styling | **Tailwind CSS 4** | Utility-first styles |
| Components | **shadcn + Base UI** | Dialogs, fields, tables, buttons |
| Charts | **Recharts** | In-match statistics (player net worth, etc.) |
| Tables | **@tanstack/react-table** | Property list / trade log |
| Icons | **lucide-react** | UI icons |

### To be chosen (sync layer)

See [section 6 "Do we need a DB / backend"](#6-do-we-need-a-db--backend) — this is the main open question.

---

## 3. Game Features (requirements)

Broken down by priority. **MVP** — the minimum for a playable match; **v1** — full "Monopoly"; **Optional** — nice-to-have extras.

### 3.1. Game board (MVP)

- A square board, 40 tiles (like classic Monopoly): 4 sides of 10 tiles each (corners + 9 tiles in between).
- Tile types:
  - **Property** (purchasable, grouped by color — usually 3 per group, with 2 of a color near the corners on long sides).
  - **Start** (`GO`) — passing it grants a fixed payout (e.g. +200).
  - **Jail / just visiting**.
  - **Go to jail** (corner).
  - **Free parking** (corner).
  - **Tax** (deducts a fixed amount).
  - **Chance / Community Chest** — cards with random events.
  - **Special objects**: railroads/stations (×4) and utilities (×2) — optional for MVP, required for v1.
- The board and tile parameters are described **declaratively** (config file `board.config.ts`) so balance and localization can be changed without touching logic.

**Requirement:** the game model (state) is fully decoupled from rendering. The board can be re-rendered entirely without touching the rules.

### 3.2. Players and tokens (MVP)

- From 2 to ~8 players; 6 recommended.
- Each player: `id`, `nickname`, `color/token`, `balance`, `position`, `ownedProperties[]`, `inJail`, `isBankrupt`.
- Visually — tokens on tiles, animated movement across tiles.

### 3.3. Dice roll and turn (MVP)

- Two dice (2×d6), the token moves by the sum.
- **Doubles** — an extra turn; three doubles in a row → jail.
- Passing through `GO` → payout.
- Turn order, "whose turn" indicator.
- **Requirement:** active actions (roll, buy, build) are available **only to the player whose turn it is**. Others are in spectator mode.

### 3.4. Buying properties (MVP)

- Landing on an unowned purchasable tile lets the player buy it at the tile's price.
- If they decline — (optional for v1) an auction among the rest.
- A bought tile is marked with the owner's color.

### 3.5. Rent (MVP)

- Landing on someone else's property, the player pays rent to the owner.
- Rent depends on: whether there's a monopoly (the whole color set owned by one player → ×2 for bare land), the number of houses/hotels, the tile type (stations/utilities have their own rules).

### 3.6. Monopoly and building (v1)

- **Monopoly** — a player owns all properties of one color (usually 3, sometimes 2).
- Houses can only be built with a monopoly (up to 4), then a hotel.
- **"Even building" requirement** (classic Monopoly rule): you cannot build a 2nd house on a tile while other tiles of the same color have 1 house.
- House cost depends on the color group.

### 3.7. Chance / Community Chest cards (v1)

- A deck of random events: receive/pay money, move, "get out of jail free", etc.
- Cards are described declaratively (like the board).

### 3.8. Jail (v1)

- Entering: "go to jail" tile, 3 doubles, a card.
- Leaving: pay a fine, roll doubles, use a "get out of jail" card.

### 3.9. Player-to-player trades (v1)

- Exchange properties / money / cards between two players.
- Confirmation by both parties.

### 3.10. Mortgage and bankruptcy (v1)

- Mortgage a property to the bank for part of its value (no buildings on it).
- If a player can't pay — sell buildings / mortgage; if it's still not enough — **bankruptcy**, assets go to the creditor or the bank.

### 3.11. Victory / end of game (v1)

- The last non-bankrupt player wins.
- An optional "quick" mode with a time/round limit and net-worth scoring.

### 3.12. Optional features

- Game log (action history) with scrolling.
- A net-worth chart over time (**Recharts** is already in the stack).
- Dice sounds/animations.
- Reconnect after a dropped connection.
- Token/avatar customization.
- Reactions/emojis, mini-chat.

---

## 4. Non-functional requirements and constraints

| Requirement | Description |
|-------------|-------------|
| **No registration** | No email/password/OAuth. Just a nickname in a room. |
| **No long-term storage** | Match state does not survive the end of the match. No personal data on the server. |
| **Small scale** | ≤ 8 players per room, dozens of concurrent rooms at most — minimal load. |
| **Low latency** | A turn-based game doesn't need shooter-grade real-time, but actions should reflect to everyone in <300 ms. |
| **Deterministic rules** | The same state + the same action → the same result for everyone (critical for sync). |
| **Fair RNG** | Dice rolls and cards must be generated in a single authoritative place to rule out desync and "unfair" rolls. |
| **Simple deploy** | Ideally static hosting + (if needed) a minimal serverless/edge server. |
| **Refresh resilience** | An accidental F5 must not drop you from the game (need reconnect by `roomId` + `playerId` from localStorage). |

### Key sync constraint

> **IndexedDB / localStorage is local storage of a single browser. It does NOT sync data between different users.**
> For players to see each other's moves, a network channel is mandatory: either direct P2P connections (WebRTC) or an intermediary server (WebSocket relay). Fully "client-only" multiplayer without any network layer does not exist.

---

## 5. Application architecture (client)

### 5.1. Layers

```
┌─────────────────────────────────────────────┐
│  UI (React 19 + Tailwind + shadcn/Base UI)   │  ← board render, dialogs, panels
├─────────────────────────────────────────────┤
│  Game State (reducer / state machine)        │  ← pure rules logic, no network/UI
├─────────────────────────────────────────────┤
│  Sync Layer (adapter)                        │  ← broadcasts actions/state between players
├─────────────────────────────────────────────┤
│  Transport (WebRTC / WebSocket / provider)   │  ← the concrete communication channel
└─────────────────────────────────────────────┘
```

### 5.2. State model

A single `GameState` object (JSON-serializable):

```ts
type GameState = {
  roomId: string;
  phase: 'lobby' | 'rolling' | 'acting' | 'trading' | 'finished';
  players: Player[];
  currentPlayerId: string;
  board: TileState[];      // owner, houses, mortgage per tile
  dice: [number, number] | null;
  log: GameEvent[];
  rngSeed: number;         // for deterministic RNG
};
```

### 5.3. Sync model: "authoritative host"

The recommended approach for a turn-based game:

- **One client is the host** (whoever created the room). It holds the "truth" — the authoritative `GameState`.
- Players send the host **intent actions** (`ROLL_DICE`, `BUY_PROPERTY`, `BUILD_HOUSE`, …), not a ready-made state.
- The host validates the action against the rules, applies it to the state, performs RNG (dice/cards), and **broadcasts the updated state** (or a delta) to everyone.
- Clients render what the host sends. Locally they keep a copy of the state for UI responsiveness, but the source of truth is the host.

Why:
- Rules out cheating and RNG desync (dice are rolled in one place).
- A simple model: 1 writer, N readers.
- Downside: if the host leaves — the match risks being interrupted → you need a host-handover mechanism or a relay server as a "neutral host" (see below).

---

## 6. Do we need a DB / backend

### Short answer

- **A full DB — NOT needed.** We don't store game history, there are no accounts — there's nothing to store.
- **Fully serverless — NOT possible.** You need at least a minimal layer to connect players via a link. The only question is how thin it is.

### Why a pure client-only app won't cover the task

Browsers on different networks can't find each other and punch through NAT on their own. Even a direct P2P connection (WebRTC) needs a **signaling server** to introduce the peers. IndexedDB doesn't help here — it's a single device's local cache.

### Implementation options (from "least server" to "most")

#### Option A — WebRTC P2P + public/thin signaling

- Players connect directly to each other (mesh) via **WebRTC DataChannel**.
- You only need lightweight **signaling** for the handshake (`PeerJS` with a public broker, or your own ~50 lines over WebSocket).
- The host client holds the authoritative state and broadcasts over P2P.
- **Pros:** no game server of your own, data doesn't pass through third-party machines, cheap.
- **Cons:** a mesh of 6–8 peers is finicky (NAT, mobile networks); if the host closes the tab — the match drops; harder to debug.
- **When to pick:** you want maximally "serverless" and can tolerate fragile connections.

#### Option B — Thin WebSocket relay (recommended) ⭐

- A small server (e.g. **PartyKit**, **Cloudflare Durable Objects**, or ~100 lines of Node + `ws`) that holds the "room" in memory.
- The server is the neutral authority: it accepts actions, applies rules (or just relays while the host client computes the rules), and broadcasts state.
- **State lives only in the room's RAM, no DB.** The room empties — the state is gone.
- **Pros:** more reliable than P2P (star instead of mesh), survives player refresh, the host client isn't critical, simple reconnect by `roomId`.
- **Cons:** you need hosting for the worker/server (but free tiers are plenty for 6 friends).
- **When to pick:** you want stability with minimal infrastructure. **The optimal balance for this project.**

> **💰 Cost — $0 for our case (verified June 2026).**
> Cloudflare Durable Objects are available on the free **Workers Free** plan provided you use the **SQLite backend** (the class is declared via `new_sqlite_classes` in a migration; the old key-value DO backend remains paid-only — we don't need it).
> Free limits: **100,000 requests/day**, 5 GB of SQLite storage, and **SQLite storage on Free is not billed at all**. Load from 6 friends is a fraction of a percent of the limit — impossible to hit.
> **PartyKit** is built on top of the same Durable Objects and inherits the same free tier, but gives a simpler "rooms" API for multiplayer — a good option if you'd rather not write a worker by hand.

#### Option C — Off-the-shelf realtime provider

- Services like **Liveblocks**, **Supabase Realtime**, **Firebase RTDB**, **Ably**.
- Sync and presence out of the box, no server to write.
- **Pros:** the least code, ready-made presence/reconnect.
- **Cons:** an external dependency and free-tier limits; technically it's "their" DB/infrastructure (but we don't store history anyway).
- **When to pick:** you want working multiplayer fastest and don't want to fuss with infrastructure.

### Recommendation

> For current goals (6 friends, no accounts, no history) — **Option B: a thin WebSocket relay (PartyKit / Cloudflare Durable Objects) with an authoritative in-memory room, no DB.** Free (see the cost block above).
> If you want to start even faster without standing up infrastructure — **Option C (Liveblocks/Supabase Realtime)**.
> Pure P2P (Option A) — tempting as "serverless", but fragile in practice for 6+ players; good as an experiment, not as the foundation.

### Role of IndexedDB / localStorage

Local storage stays useful, but **not for sync** — rather for:

- saving `playerId` + `roomId` to survive an accidental refresh and reconnect;
- a local cache of the last received `GameState` for instant rendering before fresh state arrives;
- UI settings (theme, sound).

---

## 7. User flow

1. **The host** opens the app → "Create room" → a `roomId` is generated → lands in the lobby.
2. The host copies the link `/<base>/room/<roomId>` and sends it to friends.
3. **Players** open the link → enter a nickname and pick a token color → land in the lobby.
4. The lobby shows the connected list; the host clicks "Start game" once everyone's gathered.
5. The match runs: turns in order, actions validated by the authority (host/relay), state broadcast to everyone.
6. The match ends (one non-bankrupt left / limit reached) → results screen.
7. The room closes → in-memory state is gone, nothing is saved.

---

## 8. Open questions / decide before implementation

- [ ] Final choice of sync layer (B vs C).
- [ ] Compute rules on the server (relay authority) or on the host client (relay as a "pipe")?
- [ ] What to do when the host leaves: hand off the host / make the relay authoritative / pause the match.
- [ ] Whether to support an auction on a declined purchase (classic Monopoly rule).
- [ ] Exact balance parameters (prices, rent, payouts) — extract into `board.config.ts`.
- [ ] Player cap and behavior beyond 8.
- [ ] Reconnect strategy and "dead player" timeout.

---

## 9. Proposed stages (roadmap)

1. **Stage 0 — Skeleton.** Game model + rules reducer, local (hot-seat, everyone plays on one screen). No network. Board, dice, buying, rent.
2. **Stage 1 — Network.** Wire up the chosen sync layer, lobby, link sharing, turn order across devices.
3. **Stage 2 — Full rules.** Monopoly and building, cards, jail, mortgage, bankruptcy, end of game.
4. **Stage 3 — Trades and polish.** Player-to-player trading, log, charts, reconnect, sound/animations.

---

## 10. Per-feature recommendations and pitfalls

> For each feature — what to watch out for during implementation, easy mistakes to make, and how to avoid them. Grouped by the sections of chapter 3.

### Board (3.1)

- **The declarative config is the foundation of everything.** Make `board.config.ts` the single source of truth: tile id, type, color group, price, rent by building level, house cost. The rules logic must contain no "magic numbers".
- **Reason by `id`/`type`, not coordinates.** On-screen position is a rendering concern; the rules operate on the tile index (0–39) and its type. This decouples logic from visuals.
- **Pitfall:** rent is not a single number but a table (bare / 1–4 houses / hotel + a monopoly multiplier). Design a `rent: number[]` structure up front, or you'll have to rework the model.

### Players and tokens (3.2)

- **`id` ≠ `nickname`.** A nickname can repeat/change — generate an internal `playerId` (uuid) once and keep it in localStorage for reconnect.
- **Multiple tokens on one tile is normal.** Plan the layout (offset/stack), otherwise tokens overlap and become indistinguishable.
- **Pitfall:** a bankrupt player isn't removed from the array but flagged `isBankrupt` — otherwise turn-order indices and tile-owner references will shift.

### Dice and turn (3.3)

- **RNG — only in the authority (host/relay) and via `rngSeed`.** Never roll the dice locally on each client — it will desync. Use a seedable PRNG so the roll is reproducible and verifiable.
- **A turn is a state machine**, not "roll and done": `awaiting-roll → moved → resolving-tile (buy/rent/card) → optional-build → end-turn`. Make `phase` explicit, or the UI will let buttons be pressed at the wrong time.
- **Pitfall:** doubles give an extra turn, but a third in a row → jail. Count doubles within the turn and reset the counter on `end-turn`.
- Forbid any action by a player whose turn it is not — check this **on the authority side**, not just by hiding buttons in the UI.

### Buying (3.4)

- **Atomicity:** "deduct money ↔ assign owner" is a single transaction in the reducer. A half-applied state (money deducted, owner not written) is unacceptable.
- **Pitfall — the auction.** In classic rules, a declined purchase → auction. That's a notable chunk of logic and UI; decide up front (see the open question in ch. 8) whether you include it. For MVP, "declined → tile stays with the bank" is fine.

### Rent (3.5)

- **The authority computes rent automatically** when landing on someone else's tile — don't let the payer "forget" to pay.
- Handle special cases: a mortgaged tile yields no rent; stations and utilities use their own formulas (number of stations owned / dice sum ×multiplier).
- **Pitfall:** if the payer is short on money — that's an entry into the mortgage/bankruptcy scenario (3.10), not "going negative". Tie these features together early.

### Monopoly and building (3.6)

- **The even-building rule is the most commonly forgotten detail.** You can't place a 2nd house while other tiles of the color have 0–1. Validate the house difference within the color group (≤1).
- **The house/hotel bank is limited** (32 houses / 12 hotels in classic). Decide whether you introduce scarcity — note it; without it the rules are simpler but less "authentic".
- **Pitfall:** a monopoly is lost on a trade/mortgage — recompute the right to build dynamically, don't hard-cache a "has monopoly" flag.

### Chance / Community Chest cards (3.7)

- **Card effects are data, not code.** Describe them as a union of types (`{type: 'pay', amount}`, `{type: 'move', to}`, `{type: 'getOutOfJail'}` …), with execution a single switch in the reducer. Otherwise the deck turns into a mess of ifs.
- **Shuffle the deck on the authority via the same `rngSeed`.** A "get out of jail" card must be removed from the deck while held and returned after use.

### Jail (3.8)

- It's a separate sub-phase of a turn with its own action set (pay / roll for doubles / card). Don't cram it into a normal turn with conditionals — split it into the state machine.
- **Pitfall:** "in jail" ≠ "just visiting" — it's one tile with two meanings. Store the status on the player (`inJail`, `jailTurns`), not on the tile.

### Trades (3.9)

- **Two-phase confirmation:** offer → the other party agrees → atomic apply. Nothing changes before agreement.
- **Pitfall — races:** an asset put up in a trade may have been mortgaged/changed by the time of confirmation. Re-validate the trade at apply time on the authority.
- Trades can happen **out of turn** — decide whether you allow it (classic — yes) and build it into the phase model.

### Mortgage and bankruptcy (3.10)

- **Cascade when short on money:** first offer the player to sell houses / mortgage, and only if assets still fall short — bankruptcy. Don't go negative.
- **Where assets go:** to the creditor (if the debt is to a player) or the bank (if the debt is to the bank). When going to the bank, mortgaged plots often go to auction — decide whether you support it.
- **Pitfall:** one player's bankruptcy changes the turn order, tile owners, and may end the game — it's the most branch-heavy mechanic, test it separately.

### End of game (3.11)

- Check the victory condition after each bankruptcy: one non-bankrupt left → finish.
- Build in an alternative ending (round/time limit + net-worth scoring) right away as an option — otherwise long matches will stall without a resolution.

### Network layer and general points

- **A single source of truth.** Clients don't edit state directly, only send intents. This removes 90% of desync bugs.
- **Build reconnect by `roomId`+`playerId` from the very start** (Stage 1), not at the end — reworking the network layer for it later is painful.
- **Send deltas, not the whole state** once the match grows (log, board) — but start by sending the whole state, it's easier to debug.
- **Version your messages** (`{v: 1, type, payload}`) — so an old tab with a stale client doesn't break the room.
- **Host leaving** (see ch. 8) — plan it early: under Option B the authority lives in the relay, and any player leaving (including the creator) is non-critical. That's another argument for B.
