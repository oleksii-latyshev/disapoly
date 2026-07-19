# Disapoly — Infrastructure

How the project is built, tested, deployed, and kept up to date. For what the
app *is* see [README.md](README.md); for how the code is organized see
[architecture.md](architecture.md).

---

## 1. Overview

| Concern             | Tool                                                        |
| ------------------- | ----------------------------------------------------------- |
| Runtime & packages  | Bun (`bun.lock` text lockfile)                              |
| Lint & format       | Biome (`biome.json`)                                        |
| Tests               | Vitest (`bun run test`)                                     |
| Local git hooks     | Lefthook (`lefthook.yml`)                                   |
| CI/CD               | GitHub Actions (`.github/workflows/`)                       |
| Hosting             | Cloudflare Workers (game server, Durable Object) + Cloudflare Pages (static frontend) |
| Dependency updates  | Dependabot + auto-merge workflow                            |

## 2. CI/CD pipeline

`.github/workflows/deploy.yml` — a single workflow with two jobs:

- **`check`** — runs on every push and every PR: `bun install
  --frozen-lockfile`, typecheck (`tsc -b`), `biome ci`, and the test suite.
  This is the gate everything else waits on.
- **`deploy`** — runs only on pushes to `master` (never on PRs), after `check`
  passes. Deploys the Worker (`wrangler deploy`), builds the frontend, and
  deploys it to Pages. Serialized via a `deploy` concurrency group.

Locally, Lefthook mirrors the gate before code ever reaches CI: Biome +
typecheck on pre-commit, tests on pre-push.

### Branch protection

`master` is protected by a repository ruleset:

- **Require status checks to pass** — the `check` job must be green before a
  PR can merge. This is what makes auto-merge safe: GitHub's auto-merge waits
  for required checks, so a red PR never lands.
- Force pushes and branch deletion are blocked.
- Repository admins are on the bypass list, so direct pushes to `master` by
  the owner still work.

## 3. Dependency updates (Dependabot)

Configured in [`.github/dependabot.yml`](.github/dependabot.yml).

- **Ecosystem is `bun`, not `npm`.** This matters: the `npm` ecosystem only
  rewrites `package.json`, leaving `bun.lock` stale — every PR then fails
  `bun install --frozen-lockfile` in CI. The `bun` ecosystem (supported by
  Dependabot since early 2025) updates `package.json` and `bun.lock`
  together. It requires the text-based `bun.lock` (not the legacy binary
  `bun.lockb`), which is what this repo uses.
- **Schedule:** weekly, Monday. GitHub Actions versions are updated on the
  same schedule via a separate `github-actions` ecosystem entry.
- **Groups:** minor and patch updates are batched into three grouped PRs —
  `dev-tooling` (devDependencies), `production` (dependencies), and
  `github-actions` (all workflow actions). **Major updates never join a
  group** — they arrive as individual PRs so each one can be reviewed for
  breaking changes.
- **Labels:** PRs are tagged `dependencies` (the label must exist in the
  repo, or Dependabot logs a config error on every PR).
- **Cooldown:** both ecosystems use `cooldown: default-days: 5` — a newly
  published version must be at least 5 days old before Dependabot proposes
  it. Since grouped updates auto-merge, this is insurance against
  supply-chain attacks via a compromised release: malicious versions are
  usually yanked from the registry within days. (It shrinks the window, not
  to zero — but it filters the common "compromised overnight, yanked next
  day" case.)

### Auto-merge

[`.github/workflows/dependabot-auto-merge.yml`](.github/workflows/dependabot-auto-merge.yml)
runs on every Dependabot PR and enables **squash auto-merge** when both hold:

1. the PR belongs to one of the known groups (`dev-tooling`, `production`,
   `github-actions`), and
2. the highest update type in the PR is not a semver-major bump.

Everything else — i.e. every major update — waits for a human. The merge
itself is still gated by the ruleset: auto-merge only completes after the
`check` job passes.

To re-trigger auto-merge on an already-open PR (e.g. after changing this
workflow), comment `@dependabot rebase` on the PR.

## 4. Planned improvements

Roughly in priority order:

1. **Faster CI.** Cache `~/.bun/install/cache` keyed on the `bun.lock` hash,
   and add a `concurrency` group with `cancel-in-progress: true` to the
   `check` job so a new push to a PR cancels the superseded run.
2. **PR preview deployments.** On PRs, `wrangler pages deploy dist
   --branch=<branch>` publishes a Pages preview environment — every PR gets a
   live frontend URL to click through before merging.
3. **Migrate Pages → Workers Static Assets.** Cloudflare now recommends
   serving static assets from the Worker itself (`assets` in
   `wrangler.jsonc`) instead of a separate Pages project. This collapses
   `deploy:all` into a single `wrangler deploy`, puts the frontend and the
   websocket server on one origin, and removes the hardcoded
   `VITE_PARTYKIT_HOST` entirely.
4. **Secret scanning.** If the repo is public, enable Secret scanning + Push
   protection (free for public repos) to catch an accidentally committed
   Cloudflare token before it lands.
