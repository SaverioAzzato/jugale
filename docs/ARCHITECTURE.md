# Architecture — :JUGALE ("Your character, always yours.")

> Status: **Implemented** · Last reviewed: 2026-08-03
> This is the spec-first source of truth for technical decisions. Code follows this doc; when they disagree, fix one of them on purpose, not by accident.

Development practices and the Definition of Done live in [ENGINEERING.md](ENGINEERING.md); this
document owns system topology, state ownership and host boundaries.

## 1. Vision & non-negotiable principles

A character-sheet platform where **the JSON is the character** and the app is a beautiful, stateless lens over it.

1. **`character.json` is the single source of truth.** Always human- and GPT-readable/editable. No character-specific content ever lives in code.
2. **The renderer is stateless and data-driven.** The UI is generated *from* the data + a layout description, never hand-wired per character or per class.
3. **One web codebase → every platform.** Web (GitHub Pages), desktop, and mobile all run the exact same frontend.
4. **Freedom within structure.** The schema is structured enough to validate rules and generate UI, free enough for any class/homebrew, and simple enough for an LLM to manipulate by hand. (See `SCHEMA.md`.)
5. **Free & open distribution.** No app stores required, no hosting bills. GitHub Releases + GitHub Pages.
6. **Spec-first, tested, automated.** Architecture and schema specs precede code; everything is covered by tests; CI/CD does the building and shipping.
7. **Low legal & licensing risk, on purpose.** Ship only CC-BY-4.0-licensed SRD 5.1 example content (the 2014 fifth-edition rules) as defaults — SRD 5.2.1 is a distinct revised rules line that must be named explicitly, and a commercial sourcebook is never hardcoded into schema defaults, prompts, or seed material. User-authored links remain first-class references, but the app only opens them externally: it never fetches, scrapes, caches, previews, proxies, indexes, or reproduces the destination. No in-app chat/LLM ingests arbitrary user-supplied content; external chatbots via the published JSON Schema are the supported integration point instead, and prompts permit automated retrieval only where the source's licence and terms expressly allow it. See `LEGAL.md`, `ROADMAP.md` ("Explicitly out of scope") and the M3 prompts section.

## 2. Stack decision (resolved)

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Types make schema + rules validation tractable and reduce bugs; great agent support. |
| UI framework | **React 18 + Vite** | Best ecosystem & agent familiarity, fast HMR, trivial static build for Pages. |
| Data validation | **Zod** (schema-as-code) → emits **JSON Schema** | One definition validates at runtime *and* exports a JSON Schema we publish for GPTs/external tools. |
| State | **Zustand** | Tiny, testable, no boilerplate; character state and small UI preference stores remain independently testable. |
| Styling | **Project CSS + design tokens (CSS vars)** | A bespoke Arcane token layer; themes (dark/night/light) are selected through CSS variables. |
| Native shell | **Tauri 2** | Single shell for desktop (Win/Mac/Linux) **and** mobile (Android/iOS), wrapping the same web build. Tiny binaries, secure, mostly-config Rust. |
| Web target | **Same Vite build → GitHub Pages** | The website *is* the app. |
| Unit/component tests | **Vitest + Testing Library** | Vite-native, fast. |
| E2E tests | **Playwright** | Critical Chromium flows at desktop/mobile viewports, traces/screenshots on failure, runs in CI. |
| CI/CD | **GitHub Actions** | PR checks, multi-platform release builds, Pages deploy — free on public repos. |

### Why Tauri over Flutter / React Native
The frontend choice (a web SPA) already implies the answer, because the GitHub Pages site must be byte-for-byte the same app. Flutter would mean rewriting the UI in Dart with heavy canvas rendering (kills the "it's just an open web page" ethos). React Native isn't web and needs a separate, immature desktop story. Tauri 2 wraps our **one** web build for desktop and mobile, so there is exactly one frontend codebase.

## 3. Effective module structure

```
src/
  schema/         # Zod schemas + types + JSON Schema export + migrations (1.0.0 -> 2.2.0)
  model/          # Pure domain logic: derived stats, rules validation, resource math, units, multiclass
  state/          # Store factory, pure character mutations, persistence/version coordinators
  storage/        # StorageProvider, recents/version core, browser/Tauri/Android adapters
  app/            # Focused shell hooks: opening, recents, incoming share, overlay navigation
  render/         # Data-driven sheet sections and edit primitives
  ui/             # Application chrome, overlays, JSON editor and dice UI
  help/ prompts/  # Typed Help content and external-chatbot prompt composition
  share/ update/  # Host-facing share and update orchestration
  i18n/ theme/    # Locale catalogs, design tokens and persisted themes
  styles/         # Feature CSS imported in explicit cascade order
docs/             # Engineering guide, architecture/schema specs, ADRs and delivery docs
src-tauri/        # Tauri config, Rust shell and local Android plugins
characters/       # Sample characters for dev/tests (one per class archetype); gitignored real PGs
```

The permitted dependency direction and extraction rules are normative in
[ENGINEERING.md](ENGINEERING.md#dependency-direction-and-ownership).

## 4. Data flow

```
load file ─▶ source document ─▶ supported migration ─▶ draft document
                                                            │
                                     validate without replacing the draft
                                      ┌──────────────┴──────────────┐
                                      │                             │
                         render projection                 validation result
                       (defaults/best effort)       (valid / invalid / future)
                                      │                             │
                          UI reads only              valid draft is wrapped as
                                                     PersistableCharacterDocument
                                                                    │
                                            debounced save ─▶ StorageProvider.write()
```

- **The draft is the user's document.** Validation observes it without replacing it with Zod's
  parsed/default-filled output. Inline edits, live play changes and accepted raw-JSON edits patch
  this lossless draft.
- **The projection is UI-only.** An invalid character still renders best-effort and surfaces a
  non-destructive issues panel, but no projection or synthetic fallback can be persisted, exported
  as canonical, or snapshotted.
- **Persistence is fail-closed.** Only a schema-valid draft on a supported version can produce the
  explicit persistable value accepted by the persistence coordinator. Rule inconsistencies remain
  warnings and do not block saving.
- **Syntax and schema errors are distinct.** Invalid JSON text remains only in the raw editor
  buffer. Parsed but schema-invalid JSON becomes the draft, keeps all data, and suspends canonical
  auto-save until corrected.
- **Migration is in-memory and version-aware.** Older supported documents migrate into the draft
  and persist only on a real save. Future-schema documents are never migrated or automatically
  rewritten; they open read-only for best-effort viewing and lossless export.

The normative state model, ownership rules, write-flow census and recovery policy are recorded in
[ADR 0001](decisions/0001-lossless-character-document.md). This invariant applies above every web,
desktop and Android storage adapter.

### Application and state boundaries

`src/state/store.ts` exports an instantiable character-store factory. It owns the state transition
surface, but receives clock, RNG, scheduling, toast, dice presentation, settings and export as
explicit ports. `src/characterStore.ts` is the application composition root that binds those ports
to the browser/native UI stores and exports the production singleton. Consequently, `state/` and
`model/` do not import from `ui/`, and tests can construct isolated stores with deterministic
dependencies.

Pure play-state transformations live in `state/characterMutations.ts`. The persistence coordinator
owns debounce, write serialization, cancellation and flush; the version coordinator owns snapshot
creation and safe whole-character replacement. Both receive controlled state/provider functions,
so their ordering and failure paths are testable without rendering the application shell.

`App.tsx` only composes the sheet and overlays. Host-specific opening, recents, incoming Android
shares and overlay/back navigation live in focused hooks under `app/`; `AppToolbar` owns toolbar
capacity and overflow behavior. These extracted modules have direct hook/component tests in
addition to full-App and Playwright coverage.

### Side-effect boundaries

File and folder access, IndexedDB, native commands, timers, RNG, downloads and UI notifications
remain at composition or adapter edges. Core state transitions receive these capabilities through
ports; render components dispatch use cases rather than calling storage. Host detection belongs to
opening/share/update composition, while the domain and persistence coordinators remain host-neutral.

## 5. Persistence per target (the `StorageProvider` abstraction)

| Capability | Web | Desktop Tauri | Android Tauri |
|---|---|---|---|
| Pick folder/file | File System Access or file inputs | native dialog + filesystem path | SAF document/tree URI |
| Live write | Chromium writable handle | Tauri filesystem plugin | URI write while grant/provider permits |
| Recents | IndexedDB handle or read-only snapshot | path stored in IndexedDB | SAF URI stored in IndexedDB |
| Images | folder scan/object URLs | filesystem scan/asset URLs | SAF tree scan/asset URLs |
| Degraded recovery | read-only import + export | failed write → read-only + export | refused/failed write → read-only + export |

All implement the same `StorageProvider` boundary; code above opening/composition does not select a
host-specific write policy.

Persistence guarantees deliberately follow host capabilities:

- Desktop folder writes use a same-directory temporary file followed by rename for canonical JSON
  and history files. The capability grants include only the required write/rename/remove commands.
- Browser File System Access writes commit through `FileSystemWritableFileStream.close()`; the
  browser owns its safe-write implementation and does not expose rename primitives to the app.
- Android SAF writes truncate the selected document URI in place. SAF exposes neither a portable
  sibling-temp rename nor a replace primitive, so a provider/write failure is surfaced and the
  store switches to read-only/export recovery.
- Single-file desktop picks and Save As targets are written directly because a picker grant covers
  the selected file, not an arbitrary temporary sibling. Folder workspaces are the stronger atomic
  path.

Recent references are a discriminated union (`web`, `tauri`, `android`, `snapshot`) with required
platform fields. Values read from IndexedDB are validated individually; a corrupt entry is dropped
without hiding valid siblings. Storage failures cross the application boundary as typed errors with
stable codes (`not-found`, `permission-denied`, `io-failed` and workflow-specific variants) plus the
original host error as `cause`.

**Android prompt sharing (outbound implemented; transport matrix verified):** the Prompts page exposes
Share only on Android and always opens the generic system chooser—there are no chatbot package
names, provider SDKs, accounts or API keys in JUGALE. The frontend builds the same prompt, JSON
Schema, current character when required, and migration changelog when applicable in two single-file
`ACTION_SEND` variants. The primary `jugale-request.json` is a structured `application/json`
envelope; the alternate `prompt.txt` is a delimited `text/plain` bundle duplicated in `EXTRA_TEXT`.
The chooser receives the text form through `EXTRA_ALTERNATE_INTENTS`, so Android uses the preferred
JSON form for a receiver that accepts both and retains receivers that only accept text. Create never
leaks an already-open character. This contract follows real-device results: ChatGPT accepted JSON
streams but ignored `prompt.txt`; Gemini and Claude accepted `prompt.txt`, while the original
multiple/mixed share hid them. A 2026-07-29 real-device canary test of the final alternate-intent
shape confirmed that ChatGPT read only the JSON-stream marker, while Gemini and Claude read only the
text-stream marker. All three could return an updated character; the deliberately oversized stress
fixture also exposed receiver/model output behavior (Gemini truncated a 420-item response and Claude
requested confirmation) that is separate from Android transport compatibility. No third-party
sender library can make a receiver declare an intent filter or parser behavior it does not support.
The local `android-share` Tauri plugin accepts only a small filename/MIME allowlist, enforces per-file
and aggregate UTF-8 size limits, cleans `cache/shares`, and exposes only that cache through a
non-exported `FileProvider` with temporary read grants. It never exposes the source character folder.
The user's tap on Share is the disclosure gesture; no redundant confirmation precedes the system
chooser. Receiver behavior remains subject to the real-device matrix in
`.tmp/02-share-intent-mobile.md`.

**Android character sharing (inbound):** the same plugin registers the generated MainActivity for
one `ACTION_SEND` `application/json` stream. It copies no more than 5 MiB while the URI grant is
valid, strictly decodes UTF-8, requires a JSON root object and keeps one pending payload. `load`
captures cold starts; `onNewIntent` emits warm-intent events; the frontend subscribes before draining
the buffer and deduplicates by SHA-256. No data is written immediately: an accessible EN/IT dialog
shows name, schema and validation counts, identifies the destination and warns that JSON is replaced
while images remain. Existing targets use `replaceCharacter(..., "before-import")`, including its
version-history snapshot. A dedicated SAF picker also accepts another existing folder or a truly
empty one; non-empty folders without `character.json` are rejected and empty-folder creation is
deferred until final confirmation.

**Character versions (shipped):** `character.json` remains the only canonical file. A
writable folder provider may expose the optional `StorageProvider.versions` capability; single
files, browser snapshots and read-only imports do not. Snapshots are complete JSON copies under
`history/`, named `character-YYYYMMDD-HHmmss-SSS-<reason>.json`, where reason is `checkpoint`,
`before-import` or `before-restore`. The timestamp is local and filenames sort chronologically;
collisions advance to the next free millisecond. No metadata is injected into the character and
`images/` is never copied or modified. A manual checkpoint may have an optional, trimmed title;
when non-empty it lives in a sibling `<snapshot>.meta.json` sidecar, so both `character.json` and
the snapshot remain clean character documents. The persisted setting may stay enabled while an unsupported
source is open, but effective availability always comes from the current provider capability. The
preference defaults to enabled for new installations, so an old folder becomes version-capable as
soon as it is opened; no `history/` directory is created until the first real snapshot. An explicit
user choice already persisted remains authoritative.
All providers bind small history-directory primitives to one shared version-store core, so
allocation, ordering, filename validation, title handling and deletion semantics cannot drift by
host. Snapshot JSON is authoritative and title metadata is optional: a sidecar read/write/delete
failure never misreports successful snapshot content as failed. A common contract suite runs
against the Web, Tauri and Android adapters. The store serializes canonical writes behind `flushPendingSave()`: a manual checkpoint first drains
the debounce and snapshots the exact persisted state. Full replacements use one coordinator that
validates input, flushes pending play edits, creates the required safety snapshot, writes
`character.json`, then reloads through `loadCharacter` while retaining the provider and runtime
images. A failed safety snapshot aborts the replacement; a failed canonical write leaves the extra
snapshot intact, keeps the old in-memory character and switches the source to the existing
read-only/export recovery path. A shared busy guard prevents double taps and concurrent edits.
The full-page Versions overlay lists compact snapshot cards newest-first (optional title, timestamp,
reason), tolerates corrupt entries independently, and provides icon actions to restore or delete.
Restore asks only whether to save the current character to history: Yes creates a `before-restore`
snapshot, No restores directly, and Cancel does nothing. Deletion removes the snapshot and optional
title sidecar; there is no automatic retention policy.

**Help Center:** user documentation is rendered from typed, locale-specific catalogs under
`src/help/`, not embedded as long prose blocks in the page component. EN and IT keep the same six
task-first topic ids and order; catalog tests enforce parity, localized media and the absence of
implementation jargon. The home is one non-duplicated topic grid. Topic pages combine short steps,
real localized screenshots, a compact visual flow where native Android UI cannot be captured, and
native `details` only for optional troubleshooting. They also provide `#help/<topic>` deep links
and explicit task-to-task links instead of ambiguous previous/next controls; the compact layout has
no persistent table of contents. Help is available before and after opening a character. Topic
transitions move focus and scroll to the heading; Back/Escape returns home and restores focus to the
originating card before the overlay closes. Assets under `src/help/assets/` come from the
deterministic Warlock example at 390×844 and must be refreshed in EN/IT after visible UI changes.
They are lossless 780×1688 PNG captures (390×844 at 2× density), verified by
`src/help/assets.test.ts`; no personal character data is allowed.

**Dice UI:** the dice trigger is a persisted app preference rather than character data. It defaults
to a bottom-right floating control and can move to the bottom left or back into the measured toolbar.
The WebGL scene remains full-viewport, but spawn and drag positions are resolved in visual client
pixels against live DOM rectangles for the complete app bar, conditional bottom status bar, and
floating trigger. This avoids
double-scaling under both Interface scale and browser zoom. App chrome, trigger and selection menu
share a stacking layer above the transparent dice canvas; geometric collision remains the source of
truth for where a die may rest rather than relying on visual occlusion alone.

**Web folder loading (M4, shipped):** `openCharacterFolder()` uses `showDirectoryPicker()` for a live read/write folder, reading `character.json` and scanning a sibling `images/` directory (alphabetical filename order) into object URLs; browsers without that API fall back to a read-only `<input type="file" webkitdirectory>` (`importCharacterFolder`). The scanned images ride alongside the character as a runtime `images` channel on the store — they're object URLs, revoked on reload, and **never written into `character.json`** (the JSON carries no image references at all; images sort by filename and the first is the portrait, so the user specifies nothing). **Native folder/file loading (M4, shipped):** `src/storage/tauriProvider.ts` satisfies the same surface natively — `@tauri-apps/plugin-dialog`'s `open()` for the picker (its scope auto-extends to whatever the user selects, plus a `$HOME/**` capability grant as a backstop) and `@tauri-apps/plugin-fs` for read/write and `images/` directory scanning. `App.tsx` selects it over the browser path via a runtime `isTauri()` check; everything above the `StorageProvider` boundary is unaware which one is active. **Android (dedicated SAF provider):** Android has no real file paths — the OS hands back Storage Access Framework (SAF) `content://` URIs, which the stock `dialog`/`fs` plugins can't write back to, can't persist across restarts, and mishandle as if they were paths (this caused read-only saves, dead recents, and "invalid JSON" on open-folder). So Android gets its own `src/storage/androidProvider.ts` over [`tauri-plugin-android-fs`](https://github.com/aiueo13/tauri-plugin-android-fs) (Rust crate target-gated to Android in `Cargo.toml` + registered in `lib.rs`; JS bindings `tauri-plugin-android-fs-api`, versions pinned to match). It opens a folder (tree URI, the preferred path since it exposes `images/`) or a single file, **persists the read+write permission** (`persistPickerUriPermission`) so Recents reopen after a restart, and reads/writes the URI **in place** — so `character.json` stays the single source of truth at its original location, saved live exactly like desktop, no copy-in or export-only. `App.tsx` routes to it via `isAndroid()` (checked before the desktop `isTauri()` branch). Two SAF-specific gotchas the provider handles: (1) the plugin's `android-fs:default` permission set is `all-without-delete`, which **excludes every write command**, so `capabilities/android.json` grants the exact least-privilege set the provider calls — `allow-write-text-file` included (relying on `default` silently broke live save); (2) persisting the grant is **best-effort** (`tryPersist`) because some providers refuse a persistable permission and throw — swallowing that keeps a Drive-hosted file from failing the open with a misleading "invalid JSON". Cloud document providers (e.g. Google Drive) have real platform limits: Drive is **absent from the folder/tree picker** (no `ACTION_OPEN_DOCUMENT_TREE`), so Drive characters must be opened via the single-file picker; and Drive may refuse write-back, in which case the store falls back to read-only + export like the web path. The provider logic is unit-tested with the plugin mocked, but **SAF runtime behaviour is only verifiable on a real device** — see `docs/RELEASE-TESTING.md`.

## 6. Testing strategy

The layer-by-layer testing rules and Definition of Done are canonical in
[ENGINEERING.md](ENGINEERING.md#testing-strategy). The implemented gate is:

- **Schema & model: exhaustive unit tests.** Validation, migrations, derived-stat math, resource reset (short/long rest), multiclass spell-slot tables, rules consistency checks. Vitest V8 coverage is a blocking gate: the repository has an explicit global baseline and higher non-regression thresholds for `schema/`, `model/`, the character store and persistence adapters.
- **Renderers: component tests.** Each layout kind renders correct DOM from data, preserves `link`s, escapes HTML.
- **Critical flows: Playwright E2E in Chromium.** A deterministic in-browser File System Access fixture covers open, HP/resource edit, live save and reload in desktop and mobile viewports. Desktop scenarios also cover schema-invalid raw JSON followed by correction, write failure with read-only recovery/export, and folder-version create/restore. Native SAF/dialog behavior remains covered by adapter tests and real-device release checks rather than pretending a browser can reproduce it.
- **Deterministic harness.** Non-dice component tests receive a minimal `DiceScene` mock instead of attempting WebGL in jsdom; shared setup resets Zustand stores, debounce tests use fake timers, and store-factory tests inject clock, scheduler, RNG and UI-facing ports. Extracted application hooks and coordinators are tested without rendering the full `App` tree.
- **Fixtures:** a `characters/` set covering distinct mechanics (Warlock pact slots, Fighter no-caster, Cleric prepared, Sorcerer points, multiclass) doubles as test data and as living examples.
- **Startup budget:** the production entry is capped at 500 KiB minified and 150 KiB gzip by `scripts/check-bundle-budget.mjs`, which runs as part of every build. Secondary pages, CodeMirror and Three.js/DiceScene are separate chunks; DiceScene is requested only on the first roll. Help screenshots are emitted assets but become reachable only with the lazy Help chunk. The 35 KiB of source example JSON remains in the welcome path because the sample picker is primary empty-state functionality; its image URLs do not fetch image bytes until a sample is opened.

## 7. CI/CD & "ticket → PR" automation

- **PR checks** (`.github/workflows/ci.yml`): version alignment + zero-warning lint + typecheck + thresholded Vitest coverage + web build and initial-bundle budget, followed by Playwright's desktop/mobile Chromium projects, on every PR and pushes to `main`/`develop`. Failed browser runs upload the Playwright report. A second, narrow check (`tauri-check.yml`) runs `cargo check` (no bundling) only on PRs that touch `src-tauri/**`, so a broken Rust change is caught before merge without paying for a full cross-platform build on every PR.
- **Release, tag-triggered (`release.yml`, shipped):** merging PRs to `main` does **not** ship anything by itself. Pushing a version tag (`v*`) is the one trigger for both deploy targets: [`pages.yml`](../.github/workflows/pages.yml) redeploys the web app, and `release.yml` builds the Mac/Win/Linux Tauri bundles in parallel (via `tauri-apps/tauri-action`, ad-hoc signed on macOS and with signed updater artifacts + `latest.json`) plus a separate `release-android` job (Java 17, Android SDK, pinned NDK, the four `*-android` Rust targets, `tauri android init --ci` then a **release-signed** `tauri android build --apk`, verified with `apksigner`) and attaches everything — installers and the release-signed APK — to a **draft** GitHub Release on that tag — reviewed and published by hand, so a flaky build never goes public automatically. Desktop apps self-update through Tauri's updater. Android reads release metadata through the GitHub API, then a local Kotlin/Tauri plugin streams the APK into private cache, follows HTTPS redirects internally, verifies GitHub's size and optional SHA-256 digest, and opens Android Package Installer through a scoped `FileProvider`. It never hands the download to a browser or Android `DownloadManager`, avoiding their redirect/completion stall and eliminating CDN hosts from frontend capabilities. See [AUTOMATION.md](AUTOMATION.md) for signing secrets.
- **Ticket → PR**: no GitHub-Actions-runner `claude.yml` — by design, so nothing bills the Anthropic API per token. Instead, Claude Code on the web (claude.ai/code, runs on Anthropic's cloud via the GitHub App) or a local Claude Code session implements on a branch and opens a PR via `gh`, which `ci.yml` then validates. Full detail in `docs/AUTOMATION.md`.
- **Distribution is free.** Releases host the binaries; the only optional cost is code-signing/notarization to remove "unidentified developer" warnings (Apple Dev $99/yr, Windows cert) — deferred. Android APK self-signs and sideloads for free; iOS without a paid account is covered by the installable PWA.

## 8. Resolved implementation choices

- The current schema contract is defined by `src/schema/character.ts` and documented in `SCHEMA.md`; changes require migration and parity coverage.
- Styling uses the project CSS token/theme system plus feature styles under `src/styles/`, not Tailwind.
- Tauri 2 is the only native wrapper. The retired Electron prototype remains available only through the `prototype-v1` tag.

## 9. Security: Content-Security-Policy
The app renders untrusted `character.json` (downloaded, shared, AI-generated), so it ships a CSP as defence-in-depth on top of React's escaping and the `safeHref` link allowlist. There are **two CSPs kept in sync**:

- **Web** — injected as a `<meta http-equiv>` **only into the production build** by a Vite plugin (`vite.config.ts` → `cspMeta`). It is deliberately *not* applied in dev, where Vite's HMR needs inline scripts and a websocket. (GitHub Pages can't set HTTP headers, so `frame-ancestors`/clickjacking protection isn't available there — accepted gap.)
- **Tauri** — `src-tauri/tauri.conf.json` → `app.security.csp`, a superset that also allows the `asset:`/`ipc:` protocols the webview needs.

The policy is strict: `default-src 'self'`, no `unsafe-eval` (the app never evals — the formula engine is a hand-rolled parser), images limited to `'self'`/`blob:`/`data:` (portraits are `blob:` object URLs), and the only relaxation is `'unsafe-inline'` for `style-src` (inline `style={{}}` attributes).

> **The Tauri CSP can only be verified on a real native build** (no webview in CI/preview), like Android signing. If a release build shows a blank window, the rollback is one line: set `csp` back to `null` in `tauri.conf.json`. The web CSP is verified against the production build in the preview.
