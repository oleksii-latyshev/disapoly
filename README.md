# Disapoly

A 2D, browser-based take on Monopoly for playing with friends — no sign-up.
One person creates a room and shares the link; others join, pick a nickname,
and play. Game state is in-memory only (no database).

**Stack:** React 19 · Vite · TypeScript · Tailwind 4 · Motion · Cloudflare
Durable Object (via `partyserver`) for realtime, deployed to Cloudflare Pages.

See [architecture.md](architecture.md) for the full design.

## Prerequisites

- [Bun](https://bun.sh)
- For deploys: a (free) Cloudflare account

## Local development

```bash
bun install
bun run dev:party   # realtime room server (wrangler dev) → 127.0.0.1:8787
bun run dev         # client (Vite) → http://localhost:5173
```

Run both, then open the client in two tabs/devices, "Create online room", and
share the `?room=…` link. Hot-seat (one device) is also available from the home
screen and needs no server.

## Deploy

Deploys are automatic: a push to `master` triggers the GitHub Action
(`.github/workflows/deploy.yml`), which runs `bun run deploy:all` (worker →
client build → Pages).

One-time setup in the GitHub repo:

- Secret `CLOUDFLARE_API_TOKEN` — a token with **Workers Scripts: Edit** and
  **Cloudflare Pages: Edit** permissions.
- Secret `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account id.
- (Optional) Variable `VITE_PARTYKIT_HOST` — the worker host baked into the
  client. Defaults to the current deployed worker.

To deploy manually: `bun run deploy:all` (after `wrangler login`).

## Notes

- ⚠️ Don't deploy while a game is live — updating the worker restarts the room
  Durable Object and resets in-progress matches.
- The worker only needs redeploying when game logic in `src/game/**` changes;
  UI-only changes need just the client (`build` + `deploy:pages`). `deploy:all`
  always does both and is safe to re-run.
- Runs on Cloudflare's free tier (see architecture.md §6).
