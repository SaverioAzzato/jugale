# GPT prompts — building & maintaining a character with any chatbot

> Status: **shipped (M3)**. These four prompts are also available copy-ready inside the app (the book icon next to Settings) and are kept in sync with `src/prompts/prompts.ts`.

`character.json` is the contract: any chatbot that can read these instructions can build, level up, and validate a character for this app — no plugin, no API key, no lock-in. In the app's Prompts page you fill in your reference guides (and optionally a class/race focus), then copy **one** composed prompt into a chatbot's system/custom instructions (or as its first message) and talk to it normally.

## How the prompts compose

The prompts are not four unrelated blocks — they layer:

- **base** = the read-first disclaimer + the assistant's role + **Sources in scope** (your guides, printed) + (optionally) a **Focus** on a class/race + the `character.json` data contract.
- **create / level-up / validate** = the base, plus that task's step-by-step process.

Because every task prompt includes the base, the licensing disclaimer and the data contract **travel with every copied prompt** — there's no separate block you have to remember to paste. The in-app Prompts page renders all four already composed from your parameters, each with its own copy button.

## Parameters (filled in the app, printed into the prompt)

- **Reference guides** — name + optional base wiki URL, one or more. Pre-filled from the loaded character's `meta.ruleset` (which now accepts either plain strings or `{ name, url }` objects). The prompt instructs the assistant to use **only** these sources. Adding a guide here is the same act as adding it to `meta.ruleset`.
- **Focus (optional)** — a class and/or race. When set, the prompt gains a Focus section telling the assistant to tailor everything to that build; pre-filled from the loaded character. Leave empty for general-purpose prompts.

## Editing the prompts in-app

The Prompts page has **Edit** (pencil) and **Reset** (circular arrows) controls. Edit reveals the prompts' editable building blocks: the base's static text (disclaimer + role + interaction style, and the `character.json` data contract) in two fields, and each task's *addition on top of base* in its own field. The generated "Sources in scope" + "Focus" header is shown locked — it always comes from the parameter fields, never hand-edited. **Save** recomposes every prompt from the edited blocks and persists them locally (`localStorage`); **Reset** restores the shipped originals. Customizations are per-browser and don't touch any character file.

## Design rules these prompts follow

- **Content & licensing, up front.** The base opens with a read-first disclaimer: use **only** SRD content or material whose terms of use permit free and automated/AI access; don't point a chatbot at sources that prohibit scraping; don't reproduce verbatim commercial text. The user is responsible for using their chosen guides responsibly, within their terms of use, and legally — neither the assistant nor this app is responsible for misuse. The app also shows this as a banner at the top of the Prompts page.
- **Ruleset-agnostic & parametric.** No commercial sourcebook name is hardcoded. The guides in scope come from the parameters you fill in (seeded from `meta.ruleset`), and are printed verbatim into the prompt's "Sources in scope" list.
- **Teach the data-encoding conventions the renderer relies on.** The app never computes 5e rules itself — it only sums/derives from what's encoded in the JSON. The base contract covers: item-declared AC, weapon-attacks-on-the-item vs. innate-only `combat.attacks[]`, `features[]` (never `customSections[]`) for class/subclass/race/background/feat features, generic `resources[]` with `resetOn`, and the `actions[]` formula grammar for rest perks and custom buttons. The downloadable JSON Schema carries the same rules as `description` annotations. See `docs/SCHEMA.md` for the full contract.

## The four prompts

### Base
General-purpose assistant: answers rules questions (RAW vs. table-ruling), explains what the character can do, and edits `character.json` for ad hoc changes. Its **Interaction style** section sets the default for the whole family: rules questions get a direct answer, but anything that *builds or changes* the character is done **one decision at a time** — the assistant lays out the options in scope (or points to the wiki when there are too many), explains the trade-offs, and asks you to choose, rather than running ahead.

### Create
A **guided, step-by-step** character builder, not a one-shot generator. It walks the decisions in order — concept → race/subrace → class/subclass → background → ability scores → proficiencies → feats → spells → starting equipment — and at each step shows the options with what each gives, asks you to pick, then moves on (e.g. it shows the subraces and their traits and asks you to choose; proposes a base loadout and asks "keep or change?"; points you to the spell list when it's too long to inline). It only emits the `character.json` once the decisions are made (section by section for a large file).

### Level-up
Also **guided**: given an existing `character.json` and a target level/class, it walks the choices that level opens up one at a time (subclass, ASI vs feat, a feature with options, new spells), letting you decide, then applies HP, new features, new/expanded resources, new spells, and multiclass slot recalculation — leaving everything else (especially live play-state) untouched.

### Validate
Reviews an existing `character.json` for schema-shape problems (errors) and 5e rules-consistency issues (warnings), including the data-encoding conventions specifically (no duplicated spells, no stray features in `customSections[]`, stale AC, etc.), and proposes fixes for confirmation rather than silently rewriting the file.

## Getting the JSON Schema

The full machine-readable JSON Schema (generated from the same Zod source as the app, so it never drifts) is available in-app: open the Prompts page (book icon) and use **Download JSON Schema**. Hand that file to a chatbot alongside one of the prompts above if it supports file uploads, for an even more precise contract than the prose summary in the prompts themselves.

## Source of truth

The canonical prompt text lives in [`src/prompts/prompts.ts`](../src/prompts/prompts.ts) and is rendered as-is in the app's Prompts page — copy from there (or from the in-app page) rather than retyping from this document, which only summarizes intent and design rules.
