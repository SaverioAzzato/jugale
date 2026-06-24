# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A general-purpose character sheet platform for tabletop characters (D&D 5e in practice), built so that **`character.json` is the single source of truth** and the app is a stateless, data-driven renderer/editor over it. The same web front end is designed to ship everywhere from one codebase: **web** (GitHub Pages), **desktop**, and **mobile** (via Tauri 2).

The project is **mid-rewrite** from a vanilla-JS prototype to a generalized TypeScript app:
- **Current app** (root): React + Vite + TypeScript. The engine (`src/schema/`) is in place; the data-driven sheet UI is being built milestone by milestone — see `docs/ROADMAP.md`.
- **Original prototype**: a stateless ES6-module + Electron front end that the v2 app replaces. It has been removed from the working tree; recover it from git if you need a reference (`git checkout prototype-v1 -- legacy/`). Don't resurrect it for new features.

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

Full spec: **`docs/SCHEMA.md`**. A character is a folder: `character.json` + `images/`. Images are read in alphabetical filename order and the **first is the portrait** — the JSON carries **no image references at all** (the user names files; the app sorts). The canonical v2 template is `characters/example-warlock/`.

Top-level sections: `schemaVersion`, `meta`, `identity`, `classes` (array → multiclass-native), `abilities`, `proficiencies`, `combat`, `resources`, `spellcasting`, `spellSections`, `features`, `inventory`, `origin`, `narrative`, `customSections`, `session`.

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

## Agents & automation

`.github/agents/` holds two D&D 5e **end-user** prompt prototypes (`dnd-5e-character-expert`, `dnd-5e-warlock-tome-draconide`) — early sketches of chatbot guidance for building/leveling a character against `character.json`. They are **not** Claude Code subagents (Claude Code reads `.claude/agents/`); treat them as reference/seed material for the M3 prompts work.

"Ticket → PR" automation runs on Anthropic's cloud (Claude Code on the web) or locally, not on GitHub runners — there is deliberately no `claude.yml`. Either way Claude follows this file (CLAUDE.md) for project standards. See `docs/AUTOMATION.md`.
