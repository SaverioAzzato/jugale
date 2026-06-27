# Automation — CI/CD & "ticket → PR"

## Workflows in this repo

| File | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | every PR + push to `main` | typecheck → unit tests → web build. The required gate before merge. |
| `release.yml` *(added in M4)* | tag `v*` | builds desktop + Android artifacts, attaches them to a **draft** GitHub Release. |
| `pages.yml` *(added in M4)* | tag `v*` | deploys the web build to GitHub Pages. |
| `tauri-check.yml` | PR touching `src-tauri/` | fast Rust `cargo check` (no bundling). |

There is intentionally **no `claude.yml`** — see "ticket → PR" below for why.

## Release policy: web auto-deploys, native is gated (deliberate)

Both web and native ship on the **same trigger** (a `v*` tag), but they reach users differently, and that asymmetry is on purpose — not an oversight:

- **Web (`pages.yml`) deploys automatically, no gate.** It publishes the same `dist/` that `ci.yml` already builds on every PR, so by tag time the artifact is effectively pre-tested. It's also fully reversible: a bad deploy is undone by pushing another tag, live again in minutes. Low risk + reversible ⇒ no human in the loop.
- **Native (`release.yml`) builds a *draft* Release you publish by hand.** The full desktop/Android bundles are built **only at tag time** (PRs only get the fast `cargo check`), so the tag is the first time those binaries exist. And once a user has downloaded a `.dmg`/`.apk` it's on their disk for good — you can't cleanly un-ship it. First-ever build + irreversible distribution ⇒ the draft is the human review gate: check the assets, then click Publish.

So the draft step is a feature, not friction. The right way to *remove* it later is not to drop the gate but to **earn trust in the native artifacts** — add macOS notarization and real Android release-signing — and only then consider flipping `releaseDraft: false`. Until the binaries are properly signed, keep the manual publish.

## Cutting a release

The app's version number lives in **`package.json` (`version`)** — the single source of truth. It's baked into the bundle at build time (`vite.config.ts` `define: __APP_VERSION__`) and shown in the welcome-screen footer, so it must match the release tag. Keep them in lockstep **by hand**:

1. Bump `package.json` `version` to the new number (no `v` prefix, e.g. `1.3.0`), following SemVer — patch for fixes, minor for features, major for breaking changes. Commit it (typically as part of, or just before, the release PR).
2. After merging to `main`, create and push the matching tag **`v<version>`** (e.g. `v1.3.0`). The tag is what triggers `pages.yml` (web deploy) and `release.yml` (native draft).
3. Publish the drafted GitHub Release once the native assets are attached.

> **Don't confuse this with `schemaVersion`.** `package.json` `version` is the *app* release (the `v1.x` line). The `character.json` contract has its own independent `schemaVersion` (`2.0.0`), documented in [SCHEMA.md](SCHEMA.md) — the two move on separate clocks and need not agree. (The app version started at `2.0.0-dev` during the rewrite, then realigned to the `1.x` release line.)

## "ticket → PR", three ways

We deliberately use the paths where **Anthropic runs the compute** (covered by a Claude subscription), not the GitHub-Actions-runner path (which bills the Claude API per token).

### 1. Claude Code on the web (recommended, hands-off, no repo setup)
Runs in an Anthropic-managed cloud sandbox at <https://claude.ai/code>. No workflow file, no `ANTHROPIC_API_KEY` secret. Available on Pro/Max/Team (research preview).

- **Connect GitHub once:** authorize the **Claude GitHub App** during web onboarding at claude.ai/code, *or* run `/web-setup` in a terminal to sync your `gh` token to your Claude account.
- **Trigger a task:** on claude.ai/code, pick this repo and describe the ticket. The session clones the repo, reads its `CLAUDE.md` and `.claude/`, implements on a branch, and opens a PR. `ci.yml` then validates it.
- **Auto-fix PRs:** with the GitHub App installed, Claude can automatically respond to CI failures and PR review comments (the App receives the webhooks) — still on Anthropic's cloud.

### 2. Local Claude Code (zero setup, free)
Give the ticket in a Claude Code terminal session here. It implements on a branch and opens the PR with the authenticated `gh` CLI. Same result, driven from your machine.

### 3. (Not used) The GitHub Actions version
`anthropics/claude-code-action@v1` would let you type `@claude` *inside* a GitHub issue/PR, but it runs on **GitHub-hosted runners** and needs an `ANTHROPIC_API_KEY` secret (API tokens billed per use). We deliberately don't use it — it's documented at <https://code.claude.com/docs/en/github-actions> if priorities ever change.

## Branch & PR conventions
- Branches: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- PRs must pass `ci.yml` (typecheck + tests + build) before merge.
- Conventional-commit style messages keep history readable and enable future automated changelogs.
