# Code rules

How this codebase is organized and how to write code that fits in. For *what*
the product does and *why* it's built this way, see
[architecture.md](architecture.md).

## Layout

```
src/
  modules/      Cross-cutting building blocks. No dependency on features.
    game-core/  The pure rules engine (see below).
    board/      Board presentation math (tile positions, travel plans). No React.
    network/    Socket client, identity, connection quality.
    i18n/       Language provider + en/ru dictionaries + log formatting.
    sound/      Web Audio engine + provider.
    theme/      App light/dark theme provider.
  features/     User-facing slices. May use modules and other features.
    board/      Board rendering: tiles, tokens, dice, tilt, tile details.
    events/     Surprise-event visuals and settings UI.
    game/       In-game HUD shared by both modes: turn controls, panels,
                log, results, hot-seat screen, setup screen.
    trade/      Trade panel.
    auction/    Auction panel.
    online/     Home/lobby/room screens and the networked game shell.
  components/ui/  Vendored shadcn primitives — do not hand-edit style.
  hooks/        Generic React hooks with no app knowledge.
  lib/          `cn()` and similar tiny utilities.
party/          The Cloudflare Durable Object server entry.
```

Every module/feature folder groups its own `components/`, `helpers/`,
`hooks/`, `constants/`, `__tests__/` as needed, plus an `index.ts` barrel.

## Dependency direction

- `modules → modules` and `features → modules`: always fine.
- `features → features`: only through the other feature's barrel
  (`@/features/board`), and only downward: `online → game → board → events`;
  `trade` and `auction` are leaves. Never create a cycle.
- `modules` never import from `features`.
- Inside a folder, use relative imports; from outside, import the barrel
  (`@/modules/game-core`, `@/features/game`). Don't deep-import another
  slice's internals.

## The game core is sacred

`src/modules/game-core` is a pure, deterministic rules engine that also runs
inside the Cloudflare Worker (`party/server.ts` imports it by relative path):

- **No React, no DOM, no `@/` alias, no I/O.** Plain TypeScript only.
- **No `Math.random()` / `Date.now()`** — all randomness advances `rngSeed`
  (`helpers/rng.ts`), so every client and the server derive identical states.
- State changes flow through `gameReducer(state, action)`. The dispatcher
  (`reducer/index.ts`) clones the state and gates each action by phase; the
  domain handlers (`reducer/turn.ts`, `payments.ts`, `auction.ts`, …) mutate
  that clone and return it.
- Read-only logic lives in `helpers/selectors.ts` (queries) and
  `helpers/validators.ts` (can-do checks); the UI shares these — never
  re-derive rules in a component.
- User-visible text never appears in the core. Log entries are
  `{ key, params }` i18n data; the client renders them.

## Functional style

- Prefer small, pure, named functions over inline logic. If a component grows
  a nontrivial computation, extract it into the feature's `helpers/` and unit
  test it there.
- No classes outside the Durable Object server (the platform requires one).
- Derive, don't duplicate: compute view data from `GameState` on render
  instead of mirroring it into React state.

## Comments

Aim for zero. Name things so the code reads without them. A comment is
justified only for a constraint the code cannot express — a race a timer must
survive, a classic-rules subtlety, a persistence-compat fallback. Never write
comments that restate the code, narrate history, or reference tickets/stages.

## Tests

- Vitest, `__tests__/` next to the code, `*.test.ts`, node environment — so
  only pure code is testable; keep logic out of components if you want it
  tested.
- Prefer many small unit tests of one helper (`buildings.test.ts`,
  `payments.raisecash.test.ts`) over broad scenario tests; keep scenario
  tests (`reducer.*.test.ts`) for cross-cutting rules like doubles or
  bankruptcy.
- Use the builders in `game-core/__tests__/helpers.ts` (`newGame`,
  `withNextRoll`, `give`) instead of hand-rolling states.

## Language & i18n

- Everything in the repo — code, comments, docs, commit messages — is English.
- Every user-visible string goes through `useT()` with a key in **both**
  `en.ts` and `ru.ts` (a test enforces key parity).

## Workflow

```
bun run typecheck   # tsc over app, node, and worker configs
bun run lint        # eslint
bun run test        # vitest (pure core + module helpers)
bun run build       # tsc -b && vite build
```

All four must pass before a push; CI runs them and blocks deploys otherwise.
