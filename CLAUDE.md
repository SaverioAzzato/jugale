# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A general-purpose character sheet platform for tabletop characters (D&D 5e in practice), built so that **`character.json` is the single source of truth** and the app is a stateless, data-driven renderer/editor over it. The same web front end is designed to ship everywhere from one codebase: **web** (GitHub Pages), **desktop**, and **mobile** (via Tauri 2).

The project is **mid-rewrite** from a vanilla-JS prototype to a generalized TypeScript app:
- **Current app** (root): React + Vite + TypeScript. The engine (`src/schema/`) is in place; the data-driven sheet UI is being built milestone by milestone — see `docs/ROADMAP.md`.
- **Legacy prototype** (`legacy/`): the original stateless ES6-module + Electron front end, frozen but still runnable (open `legacy/index.html` or run its Electron entry). Do not build new features here; it exists for reference and migration.

Read the spec-first docs before non-trivial work: `docs/ARCHITECTURE.md`, `docs/SCHEMA.md`, `docs/ROADMAP.md`, `docs/AUTOMATION.md`.

## Commands

- `npm run dev` — Vite dev server
- `npm test` — Vitest unit tests (`npm run test:watch` for watch mode)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck + production web build (`vite build`)

Node 20+. Tauri (desktop/mobile) tooling and a Tailwind design system arrive in later milestones (M2/M4); they are not wired up yet.

## Architecture

### One web front end, three hosts
The React app is the single front end. It runs as a static site (web/Pages) and, later, wrapped by Tauri 2 for desktop and mobile. Host-specific filesystem access (live read/write sync of `character.json`) is abstracted behind a `StorageProvider` interface — a `FileSystemAccess` implementation for the browser and a Tauri `fs` implementation for native. See `docs/ARCHITECTURE.md` §5.

### Engine — `src/schema/`
The typed core; everything else builds on it. It stores **inputs, not outputs** (modifiers, proficiency bonus, save DCs, total level are *derived*, never required in the JSON).
- `character.ts` — the Zod schema for `character.json` **v2.0.0** (the contract). `.passthrough()` everywhere so unknown keys are preserved, sensible defaults so a minimal `{ meta: { name } }` validates. Exports the `Character` type.
- `derive.ts` — derived 5e values: ability modifiers, proficiency bonus, saving throws, spell save DC / attack, multiclass total level.
- `migrate.ts` — in-memory `1.0.0 → 2.0.0` upgrade on load (persisted only on a real save); lossless (orphan v1 data is preserved as custom sections).
- `validate.ts` — `loadCharacter(raw)`: migrate → validate → derive. **Never throws and always returns a renderable character**; schema failures become `error` issues, 5e inconsistencies become `warning` issues (a half-edited file is never locked out).
- `jsonSchema.ts` — exports a JSON Schema (for external tools / GPTs).
- Tests live next to source as `*.test.ts` (Vitest).

### Data flow
`load file → migrate(schemaVersion) → validate (Zod) → state → render`. Session edits (the live fields) → debounced save via `StorageProvider`, only when live-sync is on.

## Character JSON contract (v2.0.0)

Full spec: **`docs/SCHEMA.md`**. A character is a folder: `character.json` + `images/` (alphabetical filename order; `meta.portrait.src` picks the active one). The canonical v2 template is `characters/example-warlock/`.

Top-level sections: `schemaVersion`, `meta`, `identity`, `classes` (array → multiclass-native), `abilities`, `proficiencies`, `combat`, `resources`, `spellcasting`, `spellSections`, `features`, `inventory`, `origin`, `narrative`, `customSections`, `session`.

Rules that matter when editing character data (also encoded in `.github/agents/*.agent.md`):

- **`character.json` is the single source of truth; the app is a stateless, data-driven renderer.** Never hardcode character- or class-specific content into the UI — it must come from the JSON.
- **Structural vs. live state.** Almost everything is structural (changes only on an explicit level-up/edit). Only these fields are **live** play-state the UI mutates continuously: `combat.hp.current` / `combat.hp.temp`, `resources[].current`, `inventory.items[].quantity`, `inventory.currencies.*`, and `session.*`. Nothing else should change silently from a render.
- **Generic resources, not hardcoded slots.** `resources[]` is the single model for anything spent/recovered (spell slots of any name, pact magic, ki, rage, sorcery points, arrows…). Don't reintroduce per-class hardcoded fields.
- Preserve all existing JSON fields when editing — don't drop fields outside the requested change. Unknown keys are intentionally preserved.
- Preserve clickable `link` properties on spells, feats, weapons, background, class features, etc.
- Images stay in the character's `images/` folder with alphabetically-sortable filenames; the UI scans the folder, never a hardcoded list.

## Testing & CI

Tests are first-class — the schema/model layer is exhaustively unit-tested. CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every PR; keep it green. Add/adjust tests with any schema, derivation, or migration change.

## Custom agents

`.github/agents/` defines two specialized D&D 5e rules agents (`dnd-5e-character-expert`, `dnd-5e-warlock-tome-draconide`) for character-building/optimization questions. They encode the same v2 `character.json`-is-canonical workflow described above.

`.github/workflows/claude.yml` enables the `@claude` ticket→PR automation (setup in `docs/AUTOMATION.md`); it relies on this file for project standards.
