# Architecture — :JUGALE ("D&D, but Digital")

> Status: **Draft for review** · Last updated: 2026-06-21
> This is the spec-first source of truth for technical decisions. Code follows this doc; when they disagree, fix one of them on purpose, not by accident.

## 1. Vision & non-negotiable principles

A character-sheet platform where **the JSON is the character** and the app is a beautiful, stateless lens over it.

1. **`character.json` is the single source of truth.** Always human- and GPT-readable/editable. No character-specific content ever lives in code.
2. **The renderer is stateless and data-driven.** The UI is generated *from* the data + a layout description, never hand-wired per character or per class.
3. **One web codebase → every platform.** Web (GitHub Pages), desktop, and mobile all run the exact same frontend.
4. **Freedom within structure.** The schema is structured enough to validate rules and generate UI, free enough for any class/homebrew, and simple enough for an LLM to manipulate by hand. (See `SCHEMA.md`.)
5. **Free & open distribution.** No app stores required, no hosting bills. GitHub Releases + GitHub Pages.
6. **Spec-first, tested, automated.** Architecture and schema specs precede code; everything is covered by tests; CI/CD does the building and shipping.
7. **Low legal & licensing risk, on purpose.** Ship only freely-licensed example content (the 5e SRD) as defaults — never a commercial sourcebook hardcoded into schema defaults, prompts, or seed material. No in-app chat/LLM that ingests arbitrary user-supplied content; external chatbots via the published JSON Schema are the supported integration point instead. See `ROADMAP.md` ("Explicitly out of scope") and the M3 prompts section.

## 2. Stack decision (resolved)

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Types make schema + rules validation tractable and reduce bugs; great agent support. |
| UI framework | **React 18 + Vite** | Best ecosystem & agent familiarity, fast HMR, trivial static build for Pages. |
| Data validation | **Zod** (schema-as-code) → emits **JSON Schema** | One definition validates at runtime *and* exports a JSON Schema we publish for GPTs/external tools. |
| State | **Zustand** | Tiny, testable, no boilerplate; the app state is basically "one character + session + UI flags". |
| Styling | **Tailwind + design tokens (CSS vars)** | Utility speed + a bespoke "D&D Digital" token layer; themes (dark/night/light + flagship D&D theme) via CSS variables. |
| Native shell | **Tauri 2** | Single shell for desktop (Win/Mac/Linux) **and** mobile (Android/iOS), wrapping the same web build. Tiny binaries, secure, mostly-config Rust. |
| Web target | **Same Vite build → GitHub Pages** | The website *is* the app. |
| Unit/component tests | **Vitest + Testing Library** | Vite-native, fast. |
| E2E tests | **Playwright** | Cross-browser flows, screenshots, runs in CI. |
| CI/CD | **GitHub Actions** | PR checks, multi-platform release builds, Pages deploy — free on public repos. |

### Why Tauri over Flutter / React Native
The frontend choice (a web SPA) already implies the answer, because the GitHub Pages site must be byte-for-byte the same app. Flutter would mean rewriting the UI in Dart with heavy canvas rendering (kills the "it's just an open web page" ethos). React Native isn't web and needs a separate, immature desktop story. Tauri 2 wraps our **one** web build for desktop and mobile, so there is exactly one frontend codebase.

## 3. Target module structure

```
src/
  schema/         # Zod schemas + types + JSON Schema export + migrations (1.0.0 -> 2.0.0)
  model/          # Pure domain logic: derived stats, rules validation, resource math, multiclass
  state/          # Zustand store (character, session, UI), actions, debounced-save orchestration
  storage/        # StorageProvider interface + TauriFsProvider + FileSystemAccessProvider + handle persistence
  render/         # Data-driven section renderers (one component per layout kind)
  components/     # Reusable UI primitives (cards, tables, resource trackers, lightbox, portrait, TOC)
  features/       # Feature areas: character-sheet, session-play, prompts
  theme/          # Design tokens + theme switching
  app/            # App shell, routing, bootstrap, auto-load
docs/             # ARCHITECTURE.md, SCHEMA.md, ROADMAP.md, PROMPTS.md
src-tauri/        # Tauri config + thin Rust (fs/dialog plugins)
characters/       # Sample characters for dev/tests (one per class archetype); gitignored real PGs
```

## 4. Data flow

```
load file ─▶ migrate(schemaVersion) ─▶ validate (Zod) ─▶ store.character
                                                            │
                                          render: sections derived from data + layout
                                                            │
                       session edits (HP, resources, qty, currencies) ─▶ store action
                                                            │
                                   debounced save (≈250ms) ─▶ StorageProvider.write()  (only if liveSync)
```

- **Validation is non-blocking by default**: an invalid character still loads (so a half-built or hand-edited JSON is never locked out), but surfaces a non-destructive "issues" panel. The explicit "validate" flow (and the validate prompt) can offer fixes.
- **Migration layer** upgrades older `schemaVersion` to current on load, in memory, and only persists on a real save.

## 5. Persistence per target (the `StorageProvider` abstraction)

| Capability | Web (browser) | Desktop & Mobile (Tauri 2) |
|---|---|---|
| Pick character folder/file | File System Access API picker | Tauri `dialog` + `fs` |
| Live read/write sync | `FileSystemFileHandle.createWritable()` | Tauri `fs` write |
| Remember last opened | IndexedDB handle | Tauri store / recent-list file |
| Images | scan dir handle | Tauri `fs` readdir |
| No-write fallback | import JSON → edit → **export** (with "you'll lose changes" guard on unload) | n/a (always writable) |

Both implement the same interface; the rest of the app never knows which host it's on. This generalizes the prototype's Electron-vs-browser split (its loader checked `window.electronAPI` to pick a path).

**Web folder loading (M4, shipped):** `openCharacterFolder()` uses `showDirectoryPicker()` for a live read/write folder, reading `character.json` and scanning a sibling `images/` directory (alphabetical filename order) into object URLs; browsers without that API fall back to a read-only `<input type="file" webkitdirectory>` (`importCharacterFolder`). The scanned images ride alongside the character as a runtime `images` channel on the store — they're object URLs, revoked on reload, and **never written into `character.json`** (the JSON carries no image references at all; images sort by filename and the first is the portrait, so the user specifies nothing). The Tauri `fs` implementation will satisfy the same surface natively.

## 6. Testing strategy

- **Schema & model: exhaustive unit tests.** Validation, migrations, derived-stat math, resource reset (short/long rest), multiclass spell-slot tables, rules consistency checks. This is the part where bugs cost the most, so it gets the most coverage.
- **Renderers: component tests.** Each layout kind renders correct DOM from data, preserves `link`s, escapes HTML.
- **Flows: Playwright e2e.** Open character → edit session → save/export → reload; theme switch; mobile viewport.
- **Fixtures:** a `characters/` set covering distinct mechanics (Warlock pact slots, Fighter no-caster, Cleric prepared, Sorcerer points, multiclass) doubles as test data and as living examples.

## 7. CI/CD & "ticket → PR" automation

- **PR checks** (`.github/workflows/ci.yml`): typecheck + lint + unit/component + Playwright + web build, on every PR.
- **Release** (`release.yml`): on tag `v*`, build per-platform artifacts (dmg/zip, exe/msi, AppImage, apk) and attach to a GitHub Release. Web deploy to Pages on push to `main`.
- **Ticket → PR**: no GitHub-Actions-runner `claude.yml` — by design, so nothing bills the Anthropic API per token. Instead, Claude Code on the web (claude.ai/code, runs on Anthropic's cloud via the GitHub App) or a local Claude Code session implements on a branch and opens a PR via `gh`, which `ci.yml` then validates. Full detail in `docs/AUTOMATION.md`.
- **Distribution is free.** Releases host the binaries; the only optional cost is code-signing/notarization to remove "unidentified developer" warnings (Apple Dev $99/yr, Windows cert) — deferred. Android APK self-signs and sideloads for free; iOS without a paid account is covered by the installable PWA.

## 8. Open decisions (revisit during build)
- Exact schema shape — see `SCHEMA.md`, reviewed iteratively.
- Tailwind vs hand-rolled CSS modules for the bespoke look (leaning Tailwind + tokens).
- Whether desktop also keeps an Electron fallback during the Tauri transition (default: no, go straight to Tauri).
