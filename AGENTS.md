# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

A general-purpose character sheet platform for tabletop characters (D&D 5e in practice), built so that **`character.json` is the single source of truth** and the app is a stateless, data-driven renderer/editor over it. The same web front end is designed to ship everywhere from one codebase: **web** (GitHub Pages), **desktop**, and **mobile** (via Tauri 2).

The generalized React + Vite + TypeScript app is the current product and ships on web, desktop, and Android. The milestone rewrite is complete; `docs/ROADMAP.md` is now primarily a delivery record plus the remaining polish backlog. The retired vanilla-JS/Electron prototype can be recovered from the `prototype-v1` tag if historical reference is genuinely needed. Don't resurrect it for new features.

Read the spec-first docs before non-trivial work: `docs/ARCHITECTURE.md`, `docs/SCHEMA.md`, `docs/ROADMAP.md`, `docs/AUTOMATION.md`.

## Commands

- `npm run dev` — Vite dev server
- `npm test` — Vitest unit tests (`npm run test:watch` for watch mode)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run build` — typecheck + production web build (`vite build`)
- `npm run check` — the complete web/CI gate (versions + lint + typecheck + tests + build)
- `npm run check:release` — clean install + complete gate + locked Rust check; mandatory before a release tag
- `npm run tauri dev` / `npm run tauri build` — desktop development/bundle
- `npm run tauri android dev` / `npm run tauri android build` — Android development/bundle (requires the Android SDK/NDK)

Node 20.19+. Native builds additionally require Rust; Android builds require the Android SDK/NDK. The UI uses the project's own CSS token/theme system, not Tailwind.

## Architecture

### One web front end, three hosts
The React app is the single front end. It runs as a static site (web/Pages) and is wrapped by Tauri 2 for desktop and mobile. Host-specific filesystem access (live read/write sync of `character.json`) is abstracted behind a `StorageProvider` interface, with browser File System Access, desktop Tauri fs/dialog, and Android SAF implementations. See `docs/ARCHITECTURE.md` §5.

### Engine — `src/schema/`
The typed core; everything else builds on it. It stores **inputs, not outputs** (modifiers, proficiency bonus, save DCs, total level are *derived*, never required in the JSON).
- `character.ts` — the Zod schema for the current `character.json` contract (**v2.2.0**). `.passthrough()` everywhere preserves unknown keys; sensible defaults let a minimal `{ meta: { name } }` validate. Exports the `Character` type and `SCHEMA_VERSION`.
- `derive.ts` — derived 5e values: ability modifiers, proficiency bonus, saving throws, spell save DC / attack, multiclass total level.
- `migrate.ts` — the in-memory `1.0.0 → 2.0.0 → 2.1.0 → 2.2.0` upgrade chain (persisted only on a real save); lossless where legacy fields have no direct equivalent.
- `validate.ts` — `loadCharacter(raw)`: migrate → validate → derive. **Never throws and always returns a renderable character**; schema failures become `error` issues, 5e inconsistencies become `warning` issues (a half-edited file is never locked out).
- `jsonSchema.ts` — exports a JSON Schema (for external tools / GPTs).
- Tests live next to source as `*.test.ts` (Vitest).

### Data flow
`load file → migrate(schemaVersion) → validate (Zod) → state → render`. Session edits (the live fields) → debounced save via `StorageProvider`, only when live-sync is on.

## Character JSON contract (v2.2.0)

Full spec: **`docs/SCHEMA.md`**. A character is a folder: `character.json` + `images/`. Images are read in alphabetical filename order and the **first is the portrait** — the JSON carries **no image references at all** (the user names files; the app sorts). The canonical v2 template is `characters/example-warlock/`.

Top-level sections include `schemaVersion`, `meta`, `identity`, `classes` (multiclass-native), `abilities`, `proficiencies`, `senses`, `defenses`, `combat`, `resources`, `spellSections`, `features`, `inventory`, `origin`, `narrative`, `actions`, `customSections`, and `session`. Treat `docs/SCHEMA.md` and `src/schema/character.ts` as authoritative.

Rules that matter when editing character data (also encoded in `.github/agents/*.agent.md`):

- **`character.json` is the single source of truth; the app is a stateless, data-driven renderer.** Never hardcode character- or class-specific content into the UI — it must come from the JSON.
- **Structural vs. live state.** Almost everything is structural (changes only on an explicit level-up/edit). Only these fields are **live** play-state the UI mutates continuously: `combat.hp.current` / `combat.hp.temp`, `resources[].current`, `inventory.items[].quantity`, `inventory.currencies.*`, and `session.*`. Nothing else should change silently from a render.
- **Generic resources, not hardcoded slots.** `resources[]` is the single model for anything spent/recovered (spell slots of any name, pact magic, ki, rage, sorcery points, arrows…). Don't reintroduce per-class hardcoded fields.
- Preserve all existing JSON fields when editing — don't drop fields outside the requested change. Unknown keys are intentionally preserved.
- Preserve clickable `link` properties on spells, feats, weapons, background, class features, etc.
- Images stay in the character's `images/` folder with alphabetically-sortable filenames; the UI scans the folder, never a hardcoded list.
- **Keep legal/licensing risk low.** `meta.ruleset` defaults to `["SRD"]` (the freely-licensed 5e SRD) — never hardcode a commercial sourcebook (PHB, Xanathar, Tasha, third-party content, etc.) into schema defaults, prompts, `.github/agents/`, or docs as anything other than a clearly-labeled, README-only example. Other rulesets are the user's own choice and licensing responsibility, never ours. There is **no in-app chat/LLM** — that milestone was deliberately dropped (see `docs/ROADMAP.md`, "Explicitly out of scope"); external chatbots via the published JSON Schema are the supported integration point.

## Testing & CI

Tests are first-class — the schema/model layer is exhaustively unit-tested. CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every PR; keep it green. Add/adjust tests with any schema, derivation, or migration change.

## Android prompt-share compatibility

Keep outbound chatbot sharing on Android's generic Sharesheet. The current compatibility contract
uses two alternate single-file `ACTION_SEND` intents in one chooser: primary
`application/json` (`jugale-request.json`, with instructions and named context entries) and
alternate `text/plain` (the same delimited prompt/schema/character/changelog bundle in both
`EXTRA_TEXT` and `prompt.txt`). Do not use `ACTION_SEND_MULTIPLE`, package-name targeting, guessed
deep links, `*/*`, or a third-party “share” wrapper: device tests showed that ChatGPT accepts JSON
streams but ignores the text attachment, while Gemini and Claude consume the text attachment.
Sender libraries cannot change a receiver's manifest filters or parser. The alternate-intent shape
was verified on a real device with a disposable canary harness on 2026-07-29; re-run the matrix in
`.tmp/02-share-intent-mobile.md` after any payload change or major receiver-app update.

Inbound Android sharing accepts one `ACTION_SEND` `application/json` stream through the same local
plugin. Native code copies at most 5 MiB while the temporary URI grant is live, requires strict
UTF-8 plus a JSON root object, buffers cold-start payloads and emits warm-intent events. The UI must
always preview the character and name the destination before writing. Existing folders replace via
`replaceCharacter(..., "before-import")`; a non-empty folder without `character.json` is rejected,
and an empty folder is created only after confirmation. Never broaden the manifest filter to `*/*`.

Version titles are optional history metadata stored in `<snapshot>.meta.json`, never inside either
the canonical `character.json` or the snapshot. All folder providers must keep create/list/delete
behavior aligned across browser File System Access, desktop Tauri fs, and Android SAF.

## Help Center maintenance

User-facing help lives in the typed EN/IT catalogs under `src/help/content/`; `HelpPage.tsx` is only
the renderer. Keep the six canonical topic ids/order aligned and update both locales with every
behavior change. Write for end users: lead with an action and a result; do not expose provider names,
share-intent mechanics, sync-state jargon or internal data rules outside the clearly marked advanced
topic. Advanced/troubleshooting material belongs in native collapsed `details`. Help must remain
reachable with or without an open character, and internal navigation must preserve deep links,
Back/Escape and focus restoration. Real EN/IT screenshots live in `src/help/assets/`, captured from
the deterministic Warlock example at a 390×844 viewport and exported as real lossless 780×1688 PNGs
for 2× displays. Never substitute JPEG bytes with a `.png` extension or upscale a smaller capture;
`src/help/assets.test.ts` enforces format and dimensions. Refresh both language variants after a
visible UI change; keep captions/alt text localized and never include personal character data.

## Cutting a release

Pushing a stable tag `vX.Y.Z` triggers the web deploy (`pages.yml`) and native builds (`release.yml`, a draft Release); `-dev.N` tags follow the separate procedure below. **The app version lives in four files that must all match the tag — `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` (or `cargo check --locked` fails CI). Run `scripts/set-version.sh <x.y.z>` to set all four at once** before tagging (don't bump them by hand and forget one), then run `npm run check:release`. Repository Git hooks install automatically through npm and enforce the same gate before a version tag is pushed. This is the *app* version (`1.x` line), independent of `character.json`'s `schemaVersion` (`2.2.0`). Full checklist: `docs/AUTOMATION.md` → "Cutting a release".

### Android Dev draft releases

Private device-test APKs use a separate app/channel and must follow
`docs/AUTOMATION.md` → "Android Dev draft release" exactly:

- Work from `develop`; a Dev tag is accepted only when it points exactly at `origin/develop` HEAD.
- Use monotonically increasing tags/versions `vX.Y.Z-dev.N` (for example
  `v1.13.0-dev.1`), set in all four version files with `scripts/set-version.sh X.Y.Z-dev.N`.
- Push `develop` first, then the matching tag. `.github/workflows/android-dev-release.yml` creates
  a private draft/prerelease containing only the release-signed APK.
- The APK is `JUGALE Dev` / `it.azzato.jugale.dev`, so it installs beside stable JUGALE and later
  Dev APKs upgrade only the Dev installation. Dev builds never use the stable in-app updater.
- `-dev` tags must never deploy Pages or run the stable desktop/native release jobs; those workflows
  have explicit guards. Do not publish a Dev draft. Download/test it, then delete the draft if no
  longer needed; prefer a new `.N` tag over deleting/reusing a tag.
- To promote: merge the tested work to `main`, run `scripts/set-version.sh X.Y.Z` without a suffix,
  commit/push, tag `vX.Y.Z`, and push the tag. Review the stable draft, then publish it. Stable tags
  also deploy Pages. Sync the stable release commit back into `develop` before starting the next line.

## Agents & automation

`.github/agents/` holds two D&D 5e **end-user** prompt prototypes (`dnd-5e-character-expert`, `dnd-5e-warlock-tome-draconide`) — historical seed material for chatbot guidance against `character.json`. They are not Codex subagents and must remain aligned with the schema/licensing rules when touched.

"Ticket → PR" automation runs on Anthropic's cloud (Codex on the web) or locally, not on GitHub runners — there is deliberately no `Codex.yml`. Either way Codex follows this file (AGENTS.md) for project standards. See `docs/AUTOMATION.md`.
