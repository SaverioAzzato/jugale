# Roadmap — D&D Manager

> Status: **Draft for review** · Milestones are sequential but each ships something usable. Order is a proposal — tell me if you want to reshuffle.

Cross-cutting from day one: every milestone ships with tests, runs through CI, and updates docs. The `character.json` stays the single source of truth throughout.

## M0 — Foundations & spec ✅ done
- Architecture, schema, prompts, automation docs (`docs/`).
- Repo scaffolding: Vite + React + TypeScript, Vitest.
- Formal **JSON Schema** (via Zod) + the `schemaVersion 1.0.0 → 2.0.0` migration.
- `StorageProvider` interface (browser File System Access; Tauri lands in M4).
- CI skeleton (PR checks) + a documented "ticket → PR" automation path.
- **Deliverable:** an app that loads, migrates, and validates any character — sheet still minimal.

## M1 — Generalized, data-driven engine ✅ done
- Replaced hardcoded HTML sections with data-driven renderers (one per layout kind).
- Generic **resource tracker** that subsumes HP, spell slots (any naming), pact slots, ki, rage, sorcery points, arrows, etc. — the "free slots" idea made principled.
- Full **multiclass** support and any-class rendering (no Warlock assumptions).
- Real character migrated losslessly; sample characters cover Warlock/Fighter/Cleric/Sorcerer/multiclass (also test fixtures).
- **Deliverable:** any 5e character renders and plays correctly.

## M2 — "D&D, but Digital" UI ✅ done
**Shipped (M2.1–M2.3):** centralized theming (3 themes, single token file, `src/theme/`); tabbed navigation (Gioco/Scheda/Inventario/Storia, conditional on content); responsive sticky header; gap-free per-tab masonry layout; unified open/import flow; press-and-hold HP/resource/currency steppers; file status moved to a footer bar.

**Guided makeover, see [`docs/UI.md`](UI.md).** The collaborative step-by-step brainstorm produced the structural/UX contract for the sheet: 4 tabs (Gioco/Attributi/Inventario/Storia), per-tab blocks, two modes (Play default / Edit later), and the cross-cutting data model (attacks on items + innate list, item-declared AC contributions, `resetOn`-driven rests, category-driven consumables, equipped-flag wiring, equippable flag). Implemented in full, schema-first.

**Visual pass.** The "Arcane" theme is the flagship "D&D Digital" look (dark indigo + gold, `src/theme/themes.css`); headings/panel titles render in the self-hosted `Cinzel` display face (`@fontsource/cinzel`, OFL-licensed — no CDN dependency, works offline for the M4 desktop/mobile shells too) via the `--font-display` token. Richer spell-table descriptions and an imperial/metric units toggle (ft/m, lb/kg) also shipped.

Portrait & gallery moved to M4 (needs a folder-aware `StorageProvider`, see below).
- **Deliverable:** the sheet looks modern and uncluttered, and is genuinely comfortable to run a session from. ✅

## M3 — Prompts system
The 4 prompts (base / create / level-up / validate) are written to be **rules-set agnostic and legally cautious by design**:

- **Abstracted, not hardcoded.** The base prompt frames the assistant as "a D&D expert that can use RAG to pull rules content for a configurable list of guides" driven by `meta.ruleset` — it never hardcodes a specific commercial sourcebook's name into the prompt text, the schema, or `.github/agents/` seed material.
- **SRD-only by default.** `meta.ruleset` defaults to `["SRD"]` (the freely-licensed 5e System Reference Document). Adding other guides (PHB, Xanathar, third-party content, homebrew…) is an explicit, user-driven choice via that same field — never something we ship as a default.
- **Licensing & liability clauses baked into the prompt text itself:** the user must only reference source material they hold the rights/license to use, and must respect that material's license terms and any usage policy, using it responsibly and legally; the assistant should flag ambiguous or likely non-free sources; the app and its maintainers are not responsible for a user's misuse of copyrighted material.
- **Concrete non-SRD examples are illustrative and README-only.** If we want to show "you could point this at Xanathar's if you own it," that sentence lives in the README as a labeled example — never inside the shipped prompt text, the schema defaults, or the agent seed files.
- **Teach the data-encoding conventions the renderer relies on.** The UI is a dumb-but-faithful renderer: it never computes rules itself, so the prompts must instruct the GPT to encode the inputs the renderer sums/derives. Concretely:
  - **AC** — armor and shields each encode their own AC contribution *on the item* (base + Dex handling + bonus/malus); the app sums equipped contributions and shows a provenance note (e.g. `cuoio 11 + des 3`, `no arm` for Monk, `ombra` for a Warlock's shadow armor); a manual `combat.armorClass` override always wins.
  - **Attacks** — weapon attack profiles live on the inventory item; `combat.attacks[]` is for **physical/innate non-spell** attacks only (never spells — those go in `spellSections`, or they'd show twice).
  - **Features** — class/subclass options (invocations, metamagic, maneuvers, fighting styles) go in `features[]` (so they land in the Attributi tab), **not** in `customSections[]`.
  - **Resources & rests** — `resetOn` per resource drives what rest buttons restore.
  - **Actions** — author `actions[]` (kind `shortRest`/`longRest`/`custom`) with **formulae** like `combat.hp.current = combat.hp.current + 1d8 + abilities.con.mod`. Left side = a writable field path; right side = a `+`/`-` sum of numbers, `NdM` dice, and readable paths (incl. virtuals `level`, `pb`, `maxHitDice`, `abilities.<id>.mod`). This is how class-specific rest perks and one-tap custom effects are expressed. See `docs/SCHEMA.md` → `actions[]`.

  GPTs must be instructed *carefully and explicitly* to maintain all of the above, or the sheet will render stale/empty derived values.
- Surfaced in **README + `docs/PROMPTS.md` + an in-app Prompts section** (copy-ready), plus the published JSON Schema for GPTs.
- Seed material: the early end-user agent sketches in `.github/agents/` (the project's first take on chatbot-driven character editing) — held to the same abstraction + licensing rules.
- **Deliverable:** a user can build/level/validate a character with any external chatbot, with the legal footing clear from the first line of every prompt.

## M4 — Multiplatform packaging & distribution
- Tauri desktop builds (Win/Mac/Linux) + Android APK via CI.
- GitHub Pages web build with import/export and the "you'll lose changes" unload guard.
- `release.yml`: artifacts attached to GitHub Releases on tag; downloads linked from README.
- **Portrait & gallery (Storia tab, deferred from M2):** open a character *folder* (`character.json` + `images/`, alphabetical filename order — no ordering logic in the JSON), list/lightbox the images. Needs a folder-aware `StorageProvider` (web: `showDirectoryPicker()` + a read-only `webkitdirectory` fallback; native: Tauri `fs` once wired here) — held back from M2 because it's a storage-layer feature, not just a render component.
- **Deliverable:** installable apps on Releases + a live web app, all from one push.

## M5 — Polish
- Validation UX, accessibility pass, performance, more sample characters, docs completeness, optional code-signing.

## Explicitly out of scope
- **No in-app chat/LLM.** Originally floated as an optional "BYOK chat" milestone, dropped on purpose: an in-app assistant that ingests arbitrary user-supplied rules content and proposes JSON edits is exactly the kind of legal exposure (non-permissive-license content, generated-content liability) this project wants to avoid. External chatbots (ChatGPT, Claude, etc.) driven by the M3 prompts + published JSON Schema remain the fully-supported integration path — that's the whole point of the JSON-as-contract design, at zero legal/cost surface to us.

## Suggested next concrete step
M0–M1 are done; M2.1–M2.3 shipped (theming, tabs, responsive header). The next step is **starting the guided UI makeover conversation** for the rest of M2 — going screen-by-screen, in-session-ergonomics-first, before writing more layout code.
