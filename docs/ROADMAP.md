# Roadmap — D&D Manager

> Status: **Draft for review** · Milestones are sequential but each ships something usable. Order is a proposal — tell me if you want to reshuffle.

Cross-cutting from day one: every milestone ships with tests, runs through CI, and updates docs. The `character.json` stays the single source of truth throughout.

## M0 — Foundations & spec  ⬅ start here
- Architecture, schema, prompts, automation docs (`docs/`).
- Repo scaffolding: Vite + React + TypeScript + Tailwind, Tauri 2 shell, Vitest + Playwright.
- Formal **JSON Schema** (via Zod) + the `schemaVersion 1.0.0 → 2.0.0` migration.
- `StorageProvider` interface with web + Tauri implementations.
- CI skeleton (PR checks) + the `@claude` ticket→PR workflow, with a setup guide.
- **Deliverable:** an app that loads, migrates, and validates any character — sheet still minimal.

## M1 — Generalized, data-driven engine
- Replace hardcoded HTML sections with data-driven renderers (one per layout kind).
- Generic **resource tracker** that subsumes HP, spell slots (any naming), pact slots, ki, rage, sorcery points, arrows, etc. — the "free slots" idea made principled.
- Full **multiclass** support and any-class rendering (no Warlock assumptions).
- Migrate your real character; add sample characters for other classes (also test fixtures).
- **Deliverable:** any 5e character renders and plays correctly.

## M2 — "D&D, but Digital" UI
- Bespoke design system + flagship theme (keep dark/night/light).
- Section layouts organized for in-session ergonomics; fast HP/resource/slot controls.
- Responsive + mobile layout; richer spell-table descriptions; wiki links everywhere (your favorite part).
- **Deliverable:** the sheet looks modern and is comfortable to run a session from.

## M3 — Prompts system
- The 4 prompts (configurable rules set, default 5e + Tasha + Xanathar):
  1. **Base** — "you are a D&D expert", how to do RAG on the wikis, how to read/write the JSON & schema.
  2. **Create** — progressive guided character creation.
  3. **Level-up** — ordered changes, choices, multiclass-aware.
  4. **Validate** — check vs rules + schema, propose fixes on confirmation.
- Surfaced in **README + `docs/PROMPTS.md` + an in-app Prompts section** (copy-ready), plus the published JSON Schema for GPTs.
- Seed material: the early end-user agent sketches in `.github/agents/` (the project's first take on chatbot-driven character editing).
- **Deliverable:** a user can build/level/validate a character with any external chatbot.

## M4 — Multiplatform packaging & distribution
- Tauri desktop builds (Win/Mac/Linux) + Android APK via CI.
- GitHub Pages web build with import/export and the "you'll lose changes" unload guard.
- `release.yml`: artifacts attached to GitHub Releases on tag; downloads linked from README.
- **Deliverable:** installable apps on Releases + a live web app, all from one push.

## M5 — BYOK in-app chat (optional)
- Bring-your-own-key chat (no costs to us) that can read/propose edits to the JSON using the M3 prompts.
- **Deliverable:** optional in-app assistant; external chatbots remain fully supported.

## M6 — Polish
- Validation UX, accessibility pass, performance, more sample characters, docs completeness, optional code-signing.

## Suggested first concrete step
Approve `ARCHITECTURE.md` + this roadmap + the schema principles, then I scaffold **M0** behind a PR (new app skeleton alongside the current prototype, so nothing breaks until we cut over).
