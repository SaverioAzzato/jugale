# Automation — CI/CD & "ticket → PR"

## Workflows in this repo

| File | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | every PR + push to `main` | typecheck → unit tests → web build. The required gate before merge. |
| `release.yml` *(added in M4)* | tag `v*` | builds desktop + a release-signed Android APK, attaches them to a **draft** GitHub Release. |
| `pages.yml` *(added in M4)* | tag `v*` | deploys the web build to GitHub Pages. |
| `tauri-check.yml` | PR touching `src-tauri/` | fast Rust `cargo check` (no bundling). |

There is intentionally **no `claude.yml`** — see "ticket → PR" below for why.

## Repository secrets (the whole list)

Every secret CI relies on, in one place. All are **one-time setup** (create once, reuse for every release) and only used by `release.yml`; `ci.yml`/`pages.yml`/`tauri-check.yml` need none. **Back up each value outside GitHub** — GitHub won't show it again, and losing the signing ones means you can't ship compatible updates. Set them at *Repo → Settings → Secrets and variables → Actions*.

| Secret | Purpose | Consumed by | Details |
|---|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | base64 of the release keystore (`.jks`) | `release-android` → `scripts/android-sign-setup.sh` | [Android signing](#android-signing) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore (store) password | ″ | ″ |
| `ANDROID_KEY_ALIAS` | key alias inside the keystore | ″ | ″ |
| `ANDROID_KEY_PASSWORD` | password for that alias | ″ | ″ |
| `TAURI_SIGNING_PRIVATE_KEY` | updater private key (`tauri signer generate`) | `release` (desktop matrix) → `tauri-action` | [Desktop auto-update](#desktop-auto-update-updater-signing) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | its password | ″ | ″ |

Not a secret (safe to commit): the updater **public** key lives in `tauri.conf.json` → `plugins.updater.pubkey`; the macOS ad-hoc identity is the literal `"-"` in `release.yml`, no secret needed. `GITHUB_TOKEN` is provided automatically by Actions. The subsections below explain how each group is used.

## Release policy: web auto-deploys, native is gated (deliberate)

Both web and native ship on the **same trigger** (a `v*` tag), but they reach users differently, and that asymmetry is on purpose — not an oversight:

- **Web (`pages.yml`) deploys automatically, no gate.** It publishes the same `dist/` that `ci.yml` already builds on every PR, so by tag time the artifact is effectively pre-tested. It's also fully reversible: a bad deploy is undone by pushing another tag, live again in minutes. Low risk + reversible ⇒ no human in the loop.
- **Native (`release.yml`) builds a *draft* Release you publish by hand.** The full desktop/Android bundles are built **only at tag time** (PRs only get the fast `cargo check`), so the tag is the first time those binaries exist. And once a user has downloaded a `.dmg`/`.apk` it's on their disk for good — you can't cleanly un-ship it. First-ever build + irreversible distribution ⇒ the draft is the human review gate: check the assets, then click Publish.

So the draft step is a feature, not friction. The right way to *remove* it later is not to drop the gate but to **earn trust in the native artifacts** — Android is now release-signed (see below); the remaining gap is macOS notarization — and only then consider flipping `releaseDraft: false`. Until every binary is properly signed, keep the manual publish.

### Android signing

`release.yml` builds a **release-signed** APK (not the debug-signed one Android auto-generates). `src-tauri/gen/android` is gitignored and scaffolded fresh each run, so signing can't live in the repo — `scripts/android-sign-setup.sh` injects a release `signingConfig` into the generated Gradle project from four repo secrets:

| Secret | What |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | base64 of the release keystore (`.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore (store) password |
| `ANDROID_KEY_ALIAS` | key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | password for that alias |

Generate the keystore once (`keytool -genkeypair -v -keystore jugale-release.jks -alias jugale -keyalg RSA -keysize 2048 -validity 10000`), base64 it into the secret, and **back up the keystore + passwords outside GitHub** — lose them and you can't ship same-app updates (Android rejects an APK signed with a different key). The script exits non-zero if the secrets are missing, so a release won't silently fall back to an unsigned build. The same step also regenerates the app icons from `src-tauri/icons/icon.png` so the APK ships the JUGALE icon, not Tauri's default.

After the build, a `apksigner verify` step proves the signing actually took effect — it fails the job if the APK is unsigned, debug-signed (`CN=Android Debug`), or missing the v2 signature scheme, so a mis-applied `signingConfig` can never reach a published release.

### macOS launch (ad-hoc signing)

`release.yml` passes `APPLE_SIGNING_IDENTITY: "-"` to `tauri-action` on the macOS leg so the app is **ad-hoc signed**. Without any signature, a downloaded (quarantined) app is rejected by Apple Silicon as "damaged and can't be opened"; ad-hoc signing gives it a valid signature so it launches (a one-time "unidentified developer" prompt remains — right-click → Open). Full notarization would remove that too but needs a paid Apple Developer account ($99/yr) — deferred.

### Desktop auto-update (updater signing)

Desktop builds self-update from GitHub Releases via Tauri's `updater` plugin. `release.yml` passes two secrets to `tauri-action`; with them + `plugins.updater` configured in `tauri.conf.json`, the action signs the updater artifacts and generates + uploads `latest.json` to the release, which installed apps poll.

| Secret | What |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | contents of the updater private key (`tauri signer generate`) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | its password |

The **public** key lives in `tauri.conf.json` → `plugins.updater.pubkey` (safe to commit). **Back up the private key + password outside GitHub** — losing them means installed apps can no longer verify updates. Two caveats: the endpoint (`.../releases/latest/download/latest.json`) only resolves once a release is **published** (not left as a draft); and auto-update only kicks in from the *next* release onward — a version that predates the updater has no client to check. **Android** can't use this (Tauri's updater is desktop-only), so it does a lightweight in-app GitHub-API version check that offers to open the newer APK (`src/update/`); this needs `https://api.github.com` in the Tauri CSP `connect-src`.

## Cutting a release

The app version lives in **three files that don't read from each other**, and all must match the release tag:

| File | Why it has a version |
| --- | --- |
| `package.json` | baked into the web bundle at build time (`vite.config.ts` `define: __APP_VERSION__`) and shown in the welcome-screen footer |
| `src-tauri/tauri.conf.json` | the version stamped into the installed desktop/Android app (the "About" / package version) |
| `src-tauri/Cargo.toml` | the Rust crate version (metadata) |
| `src-tauri/Cargo.lock` | must match `Cargo.toml`, or `tauri-check.yml`'s `cargo check --locked` fails |

Keep them in lockstep:

1. **Run `scripts/set-version.sh <x.y.z>`** (no `v` prefix, e.g. `1.4.0`) — it sets all four at once, **including `Cargo.lock`** (skip that and `cargo check --locked` fails CI). Follow SemVer: patch for fixes, minor for features, major for breaking changes. Commit the result (typically as part of, or just before, the release PR). *(Doing it by hand instead? Edit all four — forgetting `tauri.conf.json` ships installers labelled with the wrong version, and forgetting `Cargo.lock` breaks CI.)*
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
