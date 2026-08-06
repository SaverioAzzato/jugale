# Roadmap — :JUGALE

> Status: **M0–M6 and the engineering-quality baseline shipped.** This is now a delivery record plus the remaining polish backlog.

Current engineering practices and the Definition of Done live in [ENGINEERING.md](ENGINEERING.md);
this file records outcomes and intentionally deferred work rather than duplicating those rules.

Cross-cutting from day one: every milestone ships with tests, runs through CI, and updates docs. The `character.json` stays the single source of truth throughout.

## M0 — Foundations & spec ✅ done
- Architecture, schema, prompts, automation docs (`docs/`).
- Repo scaffolding: Vite + React + TypeScript, Vitest.
- Formal **JSON Schema** (via Zod) + the `schemaVersion` migration chain (`1.0.0 → 2.0.0 → 2.1.0 → 2.2.0`).
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
**Shipped (M2.1–M2.3):** centralized theming (3 themes, single token file, `src/theme/`); tabbed navigation (Gioco/Attributi/Inventario/Storia, conditional on content); responsive sticky header; gap-free per-tab masonry layout; unified open/import flow; press-and-hold HP/resource/currency steppers; file status moved to a footer bar.

**Guided makeover, see [`docs/UI.md`](UI.md).** The collaborative step-by-step brainstorm produced the structural/UX contract for the sheet: 4 tabs (Gioco/Attributi/Inventario/Storia), per-tab blocks, two modes (Play default / Edit later), and the cross-cutting data model (attacks on items + innate list, item-declared AC contributions, `resetOn`-driven rests, category-driven consumables, equipped-flag wiring, equippable flag). Implemented in full, schema-first.

**Visual pass.** The "Arcane" theme is the flagship look (dark indigo + gold, `src/theme/themes.css`); headings/panel titles render in the self-hosted `Cinzel` display face (`@fontsource/cinzel`, OFL-licensed — no CDN dependency, works offline for the M4 desktop/mobile shells too) via the `--font-display` token. Richer spell-table descriptions and an imperial/metric units toggle (ft/m, lb/kg) also shipped.

Portrait & gallery moved to M4 (needs a folder-aware `StorageProvider`, see below).

**Vitals follow-up.** HP control redesign (clearer current/max/temp layout, order-preserving columns), Hit Dice moved next to Temp, press-and-hold steppers fixed to stop themselves at their bounds instead of needing a second click, and death saves now clear automatically when HP is regained.

**Dice roller.** A global utility (not tied to any tab — works even before a character is loaded) for rolling all 7 D&D dice. Its persisted Settings placement is floating bottom-right by default, floating bottom-left, or in the top bar; the floating variants use a larger 56 px circular touch target while the toolbar variant stays compact. Custom three.js scene rather than an off-the-shelf 3D dice library — `@3d-dice/dice-box` was evaluated and rejected (no per-die tap API; runs in a Web Worker, so tap-to-dismiss wasn't possible). Dice tap-to-dismiss or drag-to-reposition, spawn without overlapping each other, can't be dragged through one another or into the complete app bar, conditional bottom status bar, or floating toggle, retheme live with the active skin, and use the Web Crypto RNG. Collision bounds come from visual DOM rectangles so Interface scale and browser zoom stay aligned. The selection menu and app controls render above resting dice. The toggle button itself is a small pseudo-3D cube icon (solid filled facets, transparent gaps between them) — a deliberate departure from the flat outline dice glyphs used in the roll menu.
- **Deliverable:** the sheet looks modern and uncluttered, and is genuinely comfortable to run a session from. ✅

## M3 — Prompts system ✅ done
The 4 prompts (base / create / level-up / validate) — shipped in [`src/prompts/prompts.ts`](../src/prompts/prompts.ts), an in-app Prompts page (book icon, with copy and single-file text-bundle downloads), [`docs/PROMPTS.md`](PROMPTS.md), and the README — are written to be **rules-set agnostic and legally cautious by design**:

- **Abstracted, not hardcoded.** The base prompt frames the assistant as a D&D expert working from a configurable list of guides driven by `meta.ruleset`; it retrieves content only where automated/AI access is permitted and otherwise preserves the guide as a manual reference. It never hardcodes a specific commercial sourcebook's name into the prompt text, schema, or `.github/agents/` seed material.
- **SRD 5.1-only by default.** `meta.ruleset` defaults to `["SRD 5.1"]` (the CC-BY-4.0-licensed 2014 fifth-edition rules). SRD 5.2.1 is the revised 2024/5.5e rules and must be named explicitly; the ambiguous bare `"SRD"` is not a shipped default. Adding other guides is an explicit, user-driven choice via that same field — never something we ship as a default.
- **Licensing boundaries baked into the prompt text itself:** automated/AI retrieval is limited to the SRD or sources whose licences and terms expressly allow it; lawful manual access, ownership, or a subscription are not treated as permission to scrape. Sources may still remain as manual external links, and the assistant must never bypass access controls or reproduce commercial sourcebooks verbatim.
- **Concrete non-SRD examples stay illustrative.** A guide outside the SRD may be named as a manual reference, but possession or subscription is never presented as permission for automated retrieval. Commercial sources are never selected by schema defaults, prompt text, or agent seed files.
- **Teach the data-encoding conventions the renderer relies on.** The UI is a dumb-but-faithful renderer: it never computes rules itself, so the prompts must instruct the GPT to encode the inputs the renderer sums/derives. Concretely:
  - **AC** — armor and shields each encode their own AC contribution *on the item* (base + Dex handling + bonus/malus); the app sums equipped contributions and shows a provenance note (e.g. `cuoio 11 + des 3`, `no armor` unarmored, `ombra` for a Warlock's shadow armor); a manual `combat.armorClassOverride` always wins, and with no items and no override the default is 10 + Dex.
  - **Attacks** — weapon attack profiles live on the inventory item; `combat.attacks[]` is for **physical/innate non-spell** attacks only (never spells — those go in `spellSections`, or they'd show twice).
  - **Features** — class/subclass options (invocations, metamagic, maneuvers, fighting styles) go in `features[]` (so they land in the Attributi tab), **not** in `customSections[]`.
  - **Resources & rests** — `resetOn` per resource drives what rest buttons restore.
  - **Actions** — author `actions[]` (kind `shortRest`/`longRest`/`custom`) with **formulae** like `combat.hp.current = combat.hp.current + 1d8 + abilities.con.mod`. Left side = a writable field path; right side = a `+`/`-` sum of numbers, `NdM` dice, and readable paths (incl. virtuals `level`, `pb`, `maxHitDice`, `abilities.<id>.mod`). This is how class-specific rest perks and one-tap custom effects are expressed. See `docs/SCHEMA.md` → `actions[]`.

  GPTs must be instructed *carefully and explicitly* to maintain all of the above, or the sheet will render stale/empty derived values.
- Surfaced in **README + `docs/PROMPTS.md` + an in-app Prompts section** (copy-ready), plus the published JSON Schema for GPTs (downloadable from the same in-app page, generated from the same Zod source — never drifts).
- Seed material: the early end-user agent sketches in `.github/agents/` (the project's first take on chatbot-driven character editing) — held to the same abstraction + licensing rules.
- **Deliverable:** a user can build/level/validate a character with any external chatbot, with the legal footing clear from the first line of every prompt. ✅

## M4 — Multiplatform packaging & distribution
- **Tauri desktop shell ✅ done:** `src-tauri/` (identifier `it.azzato.jugale`, app icon generated from the `:J` brand mark via `tauri icon`) wraps the same web build with no frontend changes beyond storage. `src/storage/tauriProvider.ts` implements the `StorageProvider` interface natively — `@tauri-apps/plugin-dialog` for the native open-file/open-folder pickers, `@tauri-apps/plugin-fs` for read/write and `images/` directory scanning — and `App.tsx` picks it over the browser File System Access path via a runtime `isTauri()` check. Desktop always has live read/write (no import/export fallback needed, unlike the browser's non-Chromium path). Verified locally end-to-end: `npm run tauri build` produces a working `.app`, launches, stays running, and quits cleanly.
- **Android mobile shell ✅ done:** shares the React frontend and Tauri core with desktop, with Android-specific Storage Access Framework and native updater plugins under `src-tauri/plugins/`. `src-tauri/gen/android` remains generated in CI. Tagged releases produce a universal **release-signed** APK using repository secrets, verify its signature before upload, and attach it to the draft GitHub Release. The installed app checks GitHub releases in-app, downloads through the native updater, verifies the asset, and hands it to Package Installer. The app and update path have been exercised on a real device; broader device/Android-version coverage remains ongoing polish.
- **GitHub Pages web build ✅ done:** [`pages.yml`](../.github/workflows/pages.yml) builds and deploys `dist/`. Repo is public, Pages source is set to "GitHub Actions", and the site is live at https://saverioazzato.github.io/jugale/.
- **Tag-triggered release pipeline ✅ done:** merging PRs to `main` ships nothing by itself — pushing a version tag (`v*`) is the single trigger for everything. [`pages.yml`](../.github/workflows/pages.yml) redeploys the web app; [`release.yml`](../.github/workflows/release.yml) runs Mac/Win/Linux Tauri bundles plus the release-signed Android APK and attaches them to one draft Release. Desktop updater signatures and `latest.json` are generated at release time. Published by hand after a quick check. Day-to-day native changes get Rust/Android verification without producing public bundles.
- **Portrait & gallery (Storia tab, deferred from M2) ✅ done:** open a character *folder* (`character.json` + `images/`, alphabetical filename order — no ordering logic in the JSON), list/lightbox the images. Shipped the folder-aware `StorageProvider` (web: `showDirectoryPicker()` for live read/write + a read-only `webkitdirectory` `<input>` fallback; native Tauri `fs` arrives with the desktop/mobile shells), the runtime `images` channel on the store (object URLs, revoked on reload — never persisted to the JSON, which carries no image references; images sort by filename and the first is the portrait), and a `PortraitSection` (portrait + thumbnail gallery + keyboard-navigable lightbox, shown as a chrome-less card) in the Story tab, which now also surfaces when a folder supplied images. Bundled sample images (`import.meta.glob`) let the examples demonstrate it with no real folder.
- **Deliverable:** installable apps on Releases + a live web app, all from one push.

## M5 — Polish
- **Portable JSON import ✅ done:** a top-bar Import action on web, desktop and Android picks a
  chatbot-returned JSON without modifying the selected source, reuses the inbound-share preview and
  fail-closed validation, applies through the version-aware replacement coordinator when a
  character is open, or creates `character.json` in a confirmed empty character folder when none
  is open, enabling images and version history immediately. Invalid and future-schema candidates
  never reach a write. The responsive overflow order keeps recovery
  Export ahead of occasional Import, and every icon-only control now exposes a localized hover
  hint matching its accessible name.
- **Validation UX ✅ done:** `loadCharacter`'s issues (schema errors + 5e rule-check warnings) now surface in the UI — previously generated but never displayed. Each non-schema issue carries a stable `code` + `params` (`src/schema/validate.ts`) instead of a hardcoded Italian string, localized at render time via the EN/IT catalogs (`issues.*` keys in `src/i18n/en.ts` and `src/i18n/it.ts`, with `interpolate()` in `src/i18n/useI18n.ts`); raw Zod schema errors keep their (English, technical) message as-is. A footer chip (`src/ui/IssuesChip.tsx`) shows separate error/warning counts and opens a popover listing every issue with its localized message and JSON path — non-blocking, consistent with "a half-edited file is never locked out." Out of scope for this pass: clicking an issue to jump to the relevant field in the sheet (would need every render component to tag itself with its data path — a bigger follow-up).
- **Accessibility pass ✅ done:** an audit (real WCAG contrast math, not eyeballing; live keyboard testing in the browser, not just code reading) found and fixed: (1) **the press-and-hold steppers — HP, temp HP, hit dice, resources — were entirely unusable from a keyboard**, responding only to `mousedown`/`touchstart`, never `click`; fixed in `src/render/controls.tsx` with a `event.detail === 0` guard (the same pattern `DicePalette` already used to tell a keyboard-triggered click from a real pointer one) that fires exactly one step without double-stepping a real mouse click; (2) hardcoded Italian `aria-label="meno"/"più"` on those same buttons, regardless of locale — now `t("stepper.decrease"/"stepper.increase")`; (3) the Parchment theme's `--warn`/`--gold`/`--ok` (3.7–4.2:1) and the Night/Parchment themes' `--dim` (2.5–2.9:1) were under WCAG AA's 4.5:1 (text) / 3:1 (non-text) minimums — nudged by computing the exact minimal hex shift needed (`src/theme/themes.css`, changes are barely perceptible); (4) the `IssuesChip` dialog was missing `aria-modal="true"`; (5) unlabeled inputs/textareas in `PromptsPage.tsx` (guide name/URL, the editable prompt segments) now have `aria-label`/`aria-labelledby`; (6) the tab content panel now completes the ARIA tabs pattern with `role="tabpanel"` + `aria-labelledby`/`aria-controls` wiring (`Sheet.tsx`/`App.tsx`). Also added: a shared `useFocusTrap` hook (`src/ui/useFocusTrap.ts`) applied to the two floating popovers (`DicePalette`'s dice menu, `IssuesChip`'s panel) — focuses the first control on open, traps Tab/Shift+Tab at its edges, restores focus to the trigger on close; the Settings/Prompts full-page overlays (which don't float over still-interactive content, so don't need a Tab-trap) get simpler open/Escape/restore handling in `App.tsx` — restoring by re-querying `[data-overlay-trigger]` rather than holding a DOM-node ref, since the trigger button itself unmounts while its overlay is open and a stale ref would point nowhere. Verified live in the browser (not just unit tests) for every fix, including a focus-restoration bug the first implementation attempt had. Deliberately not done in this pass: a full heading-hierarchy normalization across every `render/*.tsx` section (cosmetic, touches many files, lower urgency) and `prefers-reduced-motion` for hover transitions (already short/subtle, not loops).
- Additional sample characters, macOS notarization if distribution justifies it, and broader device coverage remain optional polish. Performance and documentation now have blocking automated baselines (see the engineering-quality section below).
- **Release compliance ✅ done:** `scripts/generate-legal-artifacts.mjs` inventories the cross-platform dependency union from both `package-lock.json` and `src-tauri/Cargo.lock`, emits a readable third-party notice plus an SPDX 2.3 SBOM into `public/`, preserves packaged licence/notice texts and MPL-2.0 source links, and fingerprints both lockfiles. Vite copies the files into every web/native frontend build; commit, CI, build and release gates reject stale artifacts. Regenerate and review them whenever either lockfile changes.

## M6 — Edit mode ✅ done (reordering deferred)
The "Edit (later milestone)" half of the M2 two-modes contract (`docs/UI.md`): a toolbar **pencil** toggle turns the whole sheet into an **inline** editor of `character.json` — every field becomes an input/select in the same curated layout, lists gain add/remove, and the save pipeline is unchanged (live sync when available, otherwise the read-only/export fallback). It edits **inputs, not outputs** (modifiers, PB, DCs, total AC stay derived at render time); `.passthrough()` unknown keys are preserved but have no dedicated editor. Built in reviewable phases (all on one branch, merged together):

- **Phase 1 — infrastructure + core stats ✅.** Transient `editMode` in the store + generic path-based edit actions (`editField`/`addItem`/`removeItem`) backed by immutable helpers (`src/model/edit.ts`) and schema-faithful blank-entry factories (`src/model/factories.ts`), with a debounced live re-validate (issues only, never the in-progress character). Reusable inline-edit primitives (`src/render/editControls.tsx`). Header name, identity fields + the multiclass list (`IdentitySection`), abilities, combat, resource CRUD. In edit mode every tab/section is shown so empty ones can be filled.
- **Phase 2 — inventory & attacks ✅.** Items CRUD (with collapsible per-item attack profiles + armor/shield AC sub-editors), currencies (add/edit/remove a code), inventory notes; innate `combat.attacks` CRUD in the Attacks panel (weapon attacks stay on their item).
- **Phase 3 — spells, features, proficiencies, actions ✅.** `spellSections`/`features` CRUD (incl. feature→resource `uses` link), per-skill proficiency/expertise toggles, language/tool/armor/weapon tag editors + PB override, `actions[]` formulae with a grammar hint.
- **Phase 4 — story & custom ✅.** narrative arrays, origin (race traits + background feature + languages), `meta.summary`, `customSections` (structured editors per layout; a validated JSON textarea for `table`/freeform rows).
- **Phase 5 — polish (deferred).** List reordering (drag + keyboard) — intentionally left for later, per the agreed "add/remove/edit now, reorder later".

## Explicitly out of scope
- **No in-app chat/LLM.** Originally floated as an optional "BYOK chat" milestone, dropped on purpose: an in-app assistant that ingests arbitrary user-supplied rules content and proposes JSON edits is exactly the kind of legal exposure (non-permissive-license content, generated-content liability) this project wants to avoid. External chatbots (ChatGPT, Claude, etc.) driven by the M3 prompts + published JSON Schema remain the fully supported integration path, with the source and retrieval boundaries stated explicitly in every build/play prompt.

## Engineering-quality baseline ✅ done (2026-08-03)

The cross-cutting remediation made the architecture enforceable rather than aspirational:

- the source document, editable draft, validated persistable document, and render projection are
  separate typed representations; invalid or fallback projections cannot overwrite
  `character.json`, and unknown keys remain lossless;
- application coordination is dependency-injected and tested independently from browser/Tauri
  adapters; storage, recents, history, Android sharing/import, and recovery paths use explicit
  result contracts instead of unchecked exceptions or casts;
- schema/model parity, persistence races and failures, accessibility behavior, and critical user
  flows have regression coverage. The suite grew from 50 files / 322 tests to 63 files / 370 tests;
- ESLint is blocking with zero warnings, global coverage is thresholded (75.21% at completion), and
  the complete web gate plus desktop/mobile Chromium E2E runs in CI;
- route-level, editor, locale, and dice-scene lazy loading reduced the initial JavaScript entry from
  1,108.37 kB / 309.85 kB gzip to 481.67 kB / 139.86 kB gzip (Vite's decimal report). A
  500 KiB / 150 KiB gzip budget
  now prevents regressions;
- documentation ownership, local-link checks, command checks, schema markers, and CI wiring are
  verified by `npm run check:docs`.
- twelve JVM tests cover extracted pure rules in the Android updater/share plugins; the native
  workflow compiles and merges the debug APK before running those suites.

Character versions, Android outbound/inbound sharing, the typed EN/IT Help Center, and the private
Android Dev release channel are shipped. Their operational contracts and release procedures are in
[AUTOMATION.md](AUTOMATION.md), while schema and persistence invariants are in
[SCHEMA.md](SCHEMA.md).

## Remaining polish and explicit debt

- Edit-mode list reordering with both drag and keyboard controls.
- Issue-to-field navigation, a full heading-hierarchy normalization, and reduced-motion treatment
  for the remaining decorative transitions.
- Broader Android/device coverage, including re-running the documented receiver matrix after share
  payload changes or major receiver-app updates.
- macOS notarization and Windows signing if distribution needs justify their account/certificate
  costs.
- Further performance work is opportunistic: the initial entry is within budget, while the deferred
  3D dice chunk remains intentionally large and is loaded only on demand.
