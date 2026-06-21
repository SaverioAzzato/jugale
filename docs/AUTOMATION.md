# Automation — CI/CD & "ticket → PR"

## Workflows in this repo

| File | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | every PR + push to `main` | typecheck → unit tests → web build. The required gate before merge. |
| `release.yml` *(added in M4)* | tag `v*` | builds desktop + Android artifacts, attaches them to a GitHub Release. |
| `pages.yml` *(added in M4)* | push to `main` | deploys the web build to GitHub Pages. |

There is intentionally **no `claude.yml`** — see "ticket → PR" below for why.

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
