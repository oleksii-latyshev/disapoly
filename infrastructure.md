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

Two speed optimizations apply to the jobs:

- **Dependency cache** — `~/.bun/install/cache` is cached keyed on the
  `bun.lock` hash, so repeat runs install from cache instead of re-downloading
  every package.
- **Superseded-run cancellation** — the `check` job uses a per-ref
  `concurrency` group with `cancel-in-progress` on PRs, so a new push to a PR
  cancels the now-stale run. Master pushes are never cancelled (a cancelled
  check would leave that commit undeployed), and the `deploy` job keeps its
  own serialized, non-cancelling group.

Locally, Lefthook mirrors the gate before code ever reaches CI: Biome +
typecheck on pre-commit, tests on pre-push.

### Workflow hardening

- **Actions are pinned to commit SHAs** (with the version in a trailing
  comment), not to tags. Tags are mutable — the `tj-actions/changed-files`
  attack (March 2025) worked by repointing existing tags at malicious
  commits that exfiltrated CI secrets. Dependabot understands SHA pins and
  keeps them (and their version comments) up to date.
- **Least-privilege tokens:** every workflow declares an explicit
  `permissions` block — `contents: read` for CI/deploy (it talks to
  Cloudflare, not the repo), `contents: write` + `pull-requests: write` only
  for the auto-merge workflow that needs them.
- **Secret scanning + push protection** are enabled (GitHub defaults for
  public repos), catching an accidentally committed Cloudflare token before
  it lands.

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
- **Security updates** (repo setting, separate from the weekly schedule):
  when a vulnerability is published for a dependency in use, Dependabot
  opens a fix PR immediately — no waiting for Monday, no cooldown. The two
  mechanisms are complementary: routine updates age safely, security fixes
  ship fast.

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

## 4. Considered and deferred

Ideas that were evaluated and consciously *not* done, so the discussion
doesn't have to be repeated later.

- **Migrate Pages → Workers Static Assets** *(deferred, July 2026)*.
  Cloudflare recommends serving static assets from the Worker (`assets` in
  `wrangler.jsonc`) instead of a separate Pages project; Pages is in
  maintenance mode. The migration would make client + server deploy as one
  atomic version (today `deploy:all` deploys the Worker first, then Pages —
  a wire-protocol change briefly skews production), collapse the pipeline
  into a single `wrangler deploy`, and remove the hardcoded
  `VITE_PARTYKIT_HOST`. Deferred because players wouldn't notice any
  difference and the public URL would change from `disapoly.pages.dev`.
  **Revisit if:** wire-protocol changes become frequent, Pages loses
  features, or a custom domain is set up anyway.
- **PR preview deployments** *(declined, July 2026)*. The workflow here is
  test-locally-then-push; PRs are mostly Dependabot's. Previews would add
  moving parts without a consumer. Also, doing them well depends on the
  Workers migration above (Pages previews only cover the frontend, pointed
  at the production Worker).
