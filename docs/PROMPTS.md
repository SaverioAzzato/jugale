# GPT prompts — building & maintaining a character with any chatbot

> Status: **shipped (M3)**. These four prompts are also available copy-ready inside the app (the book icon next to Settings) and are kept in sync with `src/prompts/prompts.ts`.

`character.json` is the contract: any chatbot that can read these instructions can build, level up, and validate a character for this app — no plugin, no API key, no lock-in. Paste exactly **one** of the four prompts below into a chatbot's system/custom instructions (or as the first message of a conversation), then talk to it normally.

## Why four separate prompts, not one

Each prompt is fully self-contained on purpose — you paste one block into a chatbot and it works standalone, so the shared rules (licensing + how to encode `character.json`) are deliberately repeated in full in each one rather than split across documents you'd have to paste together.

## Design rules these prompts follow

- **Ruleset-agnostic.** None of them hardcode a specific commercial sourcebook's name. They frame the assistant around `meta.ruleset` (default `["SRD"]`, the freely-licensed D&D 5e System Reference Document) — whatever rules sets *that* character lists are what's in scope.
- **Licensing & responsibility baked in.** Every prompt states plainly that using a source outside `meta.ruleset` is the user's own choice, that the user is responsible for holding the rights/license to that material and for using it legally, and that neither the chatbot nor this app are responsible for misuse of copyrighted content.
- **Teach the data-encoding conventions the renderer relies on.** The app never computes 5e rules itself — it only sums/derives from what's encoded in the JSON. Every prompt repeats the concrete rules: item-declared AC, weapon-attacks-on-the-item vs. innate-only `combat.attacks[]`, `features[]` (never `customSections[]`) for class/subclass/race/background/feat features, generic `resources[]` with `resetOn`, and the `actions[]` formula grammar for rest perks and custom buttons. See `docs/SCHEMA.md` for the full contract these summarize.
- **Concrete non-SRD examples are illustrative and README-only.** If you want a chatbot to use a specific commercial sourcebook, that's done by setting `meta.ruleset` on *your* character file — never something baked into the prompt text itself.

## The four prompts

### Base
General-purpose assistant: answers rules questions (RAW vs. table-ruling), explains what the character can do, and edits `character.json` for ad hoc changes. Good as a starting point for any conversation.

### Create
Walks through building a brand-new character from level 1 (or any starting level): asks the essential questions once, proposes a build, then outputs a complete `character.json`.

### Level-up
Given an existing `character.json` and a target level/class, applies the level-up correctly — HP, new features, new/expanded resources, new spells, multiclass slot recalculation — while leaving everything else (especially live play-state) untouched.

### Validate
Reviews an existing `character.json` for schema-shape problems (errors) and 5e rules-consistency issues (warnings), including the data-encoding conventions specifically (no duplicated spells, no stray features in `customSections[]`, stale AC, etc.), and proposes fixes for confirmation rather than silently rewriting the file.

## Getting the JSON Schema

The full machine-readable JSON Schema (generated from the same Zod source as the app, so it never drifts) is available in-app: open the Prompts page (book icon) and use **Download JSON Schema**. Hand that file to a chatbot alongside one of the prompts above if it supports file uploads, for an even more precise contract than the prose summary in the prompts themselves.

## Source of truth

The canonical prompt text lives in [`src/prompts/prompts.ts`](../src/prompts/prompts.ts) and is rendered as-is in the app's Prompts page — copy from there (or from the in-app page) rather than retyping from this document, which only summarizes intent and design rules.
