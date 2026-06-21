# Automation — CI/CD & "ticket → PR"

## Workflows in this repo

| File | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | every PR + push to `main` | typecheck → unit tests → web build. The required gate before merge. |
| `.github/workflows/claude.yml` | `@claude` in an issue/PR comment | runs the Claude Code agent: implements on a branch, pushes, opens/updates a PR. |
| `release.yml` *(added in M4)* | tag `v*` | builds desktop + Android artifacts, attaches them to a GitHub Release. |
| `pages.yml` *(added in M4)* | push to `main` | deploys the web build to GitHub Pages. |

## One-time setup for `@claude` (ticket → PR)

You drive this from GitHub's UI/CLI; it can't be fully scripted from here because it installs a GitHub App and adds a secret on your account. You must be a repo admin.

The workflow uses the GA action `anthropics/claude-code-action@v1`.

### Quick path (recommended)
From a terminal with Claude Code, run **`/install-github-app`**. It walks you through installing the GitHub App and adding the `ANTHROPIC_API_KEY` secret. Then skip to "Daily use".

### Manual path
1. **Install the Claude GitHub App** on this repo: <https://github.com/apps/claude> → *Configure* → select the repo. It requests Contents, Issues, and Pull requests (Read & write).
2. **Add the API key secret.** Repo → *Settings → Secrets and variables → Actions → New repository secret*:
   - Name: `ANTHROPIC_API_KEY`
   - Value: a key from <https://console.anthropic.com/>.
   - CLI alternative (you run it, so the key never passes through Claude): `gh secret set ANTHROPIC_API_KEY`.
3. **Allow Actions to open PRs.** *Settings → Actions → General → Workflow permissions* → enable **Read and write permissions** and **Allow GitHub Actions to create and approve pull requests**.

### Daily use
- Open an issue describing the ticket (e.g. *"Add a Cleric sample character and a prepared-caster fixture"*), then comment `@claude implementa questo`.
- The agent branches, commits, pushes, and opens a PR; `ci.yml` validates it; you review and merge.
- You can also `@claude` on an existing PR to request changes.

## Branch & PR conventions
- Branches: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- PRs must pass `ci.yml` (typecheck + tests + build) before merge.
- Conventional-commit style messages keep history readable and enable future automated changelogs.

## Local equivalent
You can run the same loop locally with Claude Code: open a ticket, let it implement on a branch, and it pushes + opens the PR with `gh`. The GitHub Action is just the hands-off, in-cloud version of that.
