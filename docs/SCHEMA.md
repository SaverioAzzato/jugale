# Character Schema — `character.json` v2.1.0

> Status: **Draft for review** · The contract between the JSON (source of truth), the UI (data-driven renderer), and external GPTs.
> Design goals, in order: **(1) structured enough** to validate rules and generate UI, **(2) free enough** for any class/homebrew, **(3) simple enough** for an LLM to read and edit by hand.

The canonical, machine-readable schema is the Zod definition in `src/schema/` (it also emits a JSON Schema, published for GPTs). This document is the human-facing explanation and rationale.

## 0. Core principles

- **Truth is minimal.** Store inputs, not outputs. Ability modifiers, proficiency bonus, spell save DC, total level, etc. are **derived** by the app and need not appear in the JSON. They are *accepted* if present (handy for GPTs) but the app recomputes and flags mismatches.
- **Structural vs. live state.** Almost everything is **structural** (changes only on an explicit level-up/edit). A short, enumerated set of fields is **live** (the UI updates them continuously during play):

  | Live field | Meaning |
  |---|---|
  | `combat.hp.current`, `combat.hp.temp` | current / temporary hit points |
  | `resources[].current` | remaining uses of any tracked resource |
  | `inventory.items[].quantity` | item counts you spend |
  | `inventory.currencies.*` | coins |
  | `session.*` | conditions, death saves, inspiration, session notes |

  Everything else must never change silently from a render.
- **Freedom primitives, available everywhere:** an optional `link` (wiki URL), `notes`/`description` strings, `tags: string[]`, and a top-level `customSections[]` escape hatch. Unknown extra keys are preserved on save, never dropped.
- **`id` fields** are stable, lowercase-kebab slugs used to join data (e.g. a feature's `uses.resourceId` → a `resources[]` entry) and to keep diffs clean.

## 1. Top-level shape

```jsonc
{
  "schemaVersion": "2.1.0",
  "meta":         { ... },   // identity card of the *file*: name, player, summary, ruleset
  "identity":     { ... },   // who the character is: race, background, alignment, age...
  "classes":      [ ... ],   // one entry per class → multiclass is native
  "abilities":    { ... },   // the six scores + save proficiency
  "proficiencies":{ ... },   // skills, languages, tools, armor, weapons, prof. bonus override
  "senses":       [ ... ],   // special senses as free strings ("Darkvision 18 m")
  "defenses":     { ... },   // damage resistances/immunities/vulnerabilities, condition immunities
  "combat":       { ... },   // AC, speed, initiative, HP, attacks
  "resources":    [ ... ],   // GENERIC tracked resources (slots of any name, ki, rage, arrows...)
  "spellSections":[ ... ],   // the beloved spell tables, grouped freely
  "features":     [ ... ],   // class/race/background/feat features, with links
  "inventory":    { ... },   // items, currencies, attunement, notes
  "origin":       { ... },   // race traits, background feature
  "narrative":    { ... },   // personality, appearance, backstory
  "customSections":[ ... ],  // user-defined sections rendered by a layout hint
  "session":      { ... }    // purely ephemeral play-state
}
```

Only `schemaVersion` and `meta.name` are strictly required; every section has a sensible empty default, so a half-built character still loads and validates as "incomplete" rather than "invalid".

## 2. Sections

### `meta`
```jsonc
{
  "name": "Esempio Warlock",
  "player": "Saverio",
  "summary": "Tiefling Warlock, Patto del Tomo.",
  // No image fields. The app reads the folder's images/ in alphabetical order and uses the
  // first as the portrait — the JSON never references an image path (the user just names files).
  "ruleset": ["SRD", { "name": "My Homebrew Wiki", "url": "https://wiki.example/srd" }],
                         // rules guides in scope; drives the prompts. Each entry is a bare name
                         // string or { name, url } (base wiki URL for niche guides). Default is the
                         // freely-licensed SRD only — only reference content that is SRD or otherwise
                         // free to access/scrape under its terms of use; that choice (and the
                         // licensing responsibility) is the user's.
  "tags": ["warlock", "draconide"]
}
```

### `identity`
Free-but-typed key facts. Known keys get UI affordances; extra keys are kept and shown generically.
```jsonc
{ "race": "Tiefling", "lineage": "Asmodeus", "background": "Sage",
  "alignment": "CN", "size": "Medium", "age": "24", "link": "https://..." }
```

### `classes[]` — multiclass-native
```jsonc
[
  { "name": "Warlock", "subclass": "The Fiend", "level": 5,
    "hitDie": "d8", "link": "https://...",
    "spellcasting": { "ability": "cha", "type": "known",
                      "slotProgression": "warlock" } }
]
```
- `type`: `known | prepared | none` (there is no separate `prepares` flag — `prepared` says it all). `slotProgression`: `full | half | third | warlock | none`.
- **Total level** and **proficiency bonus** are derived from this array. **Spell slots are NOT auto-computed**: model them as `resources[]` (category `spellSlot`, one entry per level). `slotProgression` is a hint for tools/GPTs building those resources, not a value the app calculates.

### `abilities`
```jsonc
{
  "str": { "score": 8,  "saveProficient": false },
  "dex": { "score": 14, "saveProficient": false },
  "con": { "score": 14, "saveProficient": false },
  "int": { "score": 12, "saveProficient": false },
  "wis": { "score": 10, "saveProficient": false },
  "cha": { "score": 17, "saveProficient": true, "modifierOverride": null }
}
```
Modifiers and save bonuses are derived. `modifierOverride` is the homebrew escape hatch.

### `proficiencies`
```jsonc
{
  "proficiencyBonusOverride": null,            // else derived from total level
  "skills": [ { "id": "arcana", "proficient": true, "expertise": false } ],
  "languages": ["Comune", "Infernale"],   // the ONE home for languages (not origin)
  "tools": ["Strumenti da calligrafo"],
  "armor": ["Leggera"],
  "weapons": ["Semplici"]
}
```

### `senses` + `defenses`
```jsonc
"senses": ["Scurovisione 18 m"],          // special senses as free strings (range included)
"defenses": {
  "resistances":         ["fuoco"],       // damage types
  "immunities":          [],
  "vulnerabilities":     [],
  "conditionImmunities": ["spaventato"]
}
```
These give two 5e concepts a single, explicit home instead of burying them in prose. `senses` is for special senses only — **passive Perception is derived** from the Perception skill and shown with the skills, not here. Anything the app shouldn't reason about (a sense or a resistance with a rules caveat) can still be written as a `features[]` entry too; these fields are for the at-a-glance mechanical list.

### `combat`
```jsonc
{
  "armorClass": 13,             // legacy / hand-set AC; used only when no equipped item declares an `ac`
  "armorClassOverride": null,   // when set, this wins over any armor-derived value (note: "manuale")
  "initiativeOverride": null, "speed": { "walk": 30, "fly": 0 },
  "hp": { "max": 38, "current": 38, "temp": 0, "hitDiceRemaining": 5 },
  "attacks": [
    // PHYSICAL / innate attacks only (breath weapon, unarmed strike, natural weapons).
    // NEVER spells — those live only in spellSections (putting a spell here too makes it
    // show up twice). Weapon attacks live on the inventory item (`inventory.items[].attacks`);
    // the combat view merges item weapons + these. Same columns as spells for consistency.
    { "name": "Arma a soffio", "link": "https://...", "level": "Razza",
      "range": "Cono 4,5 m", "attack": "Nessun tiro",                // "tiro che fai tu"
      "defense": "TS Des CD 12",                                     // "tiro avversario"
      "effect": "2d6 fuoco, metà con successo", "notes": "Recupero: riposo breve/lungo" }
  ]
}
```
`hp.current`/`hp.temp`/`hp.hitDiceRemaining` are live (max Hit Dice = total level, derived). **AC** is derived without hardcoding 5e rules: each equipped armor/shield item declares its own contribution (`items[].ac`) and the app sums them, showing a provenance note (e.g. `cuoio 11 + des 3`); `armorClassOverride` wins if set, else the stored `armorClass` is the fallback. See `derive.ts → derivedArmorClass` and `docs/UI.md`.

### `resources[]` — the generic tracker (generalizes "warlock slots")
The single model for **anything you spend and recover**: spell slots (any name/level), pact magic, ki, rage, sorcery points, channel divinity, superiority dice, bardic inspiration, arrows, potions-as-resource, etc.
```jsonc
[
  { "id": "pact-slots", "label": "Slot del Patto", "category": "spellSlot",
    "max": 2, "current": 2, "level": 3, "resetOn": "shortRest", "link": "https://..." },
  { "id": "sorcery-points", "label": "Punti Stregoneria", "category": "points",
    "max": 5, "current": 5, "resetOn": "longRest" }
]
```
- `category`: `spellSlot | points | dice | charges | ammo | custom` — picks the tracker UI (pips, number, dice…).
- `level`: only meaningful for `spellSlot`; lets the spell table know which slots can cast what.
- `resetOn`: `shortRest | longRest | dawn | manual | none` — powers the rest buttons.
- `max` is structural; **`current` is live**. Keeping them together (like inventory quantity) avoids cross-section joins and is easy for GPTs.

### `spellSections[]`
```jsonc
"spellSections": [
  { "id": "cantrips", "title": "Trucchetti", "entries": [
    { "name": "Eldritch Blast", "link": "https://...", "level": "0",
      "school": "Invocazione", "range": "120 ft",
      "castingTime": { "type": "action", "value": "", "condition": "" },
      "ritual": false,
      "components": { "verbal": true, "somatic": true, "material": false },
      "materials": [],                                   // one per material component when material:true
      "duration": "Istantaneo", "concentration": false,
      "attack": "Attacco a distanza con incantesimo",    // tiro che fai TU
      "defense": "—",                                     // tiro che fa l'AVVERSARIO
      "effect": "1d10 per raggio", "damageType": "forza", // dice + damage type (kept separate)
      "higherLevels": "2 raggi al 5°, 3 all'11°, 4 al 17°",
      "description": "Descrizione estesa, opzionale.",
      "prepared": true } ] }
]
```
Structured spell fields (v2.1.0):
- **`castingTime`** — `{ type, value, condition }`. `type` is one of `action | bonus | reaction | time`. `value` holds the amount for `type:"time"` (`"10 minutes"`); `condition` holds the trigger for `type:"reaction"` (`"when you take damage"`). A legacy string is still accepted and coerced.
- **`ritual`** — boolean. When `true`, fill `duration` (a warning fires otherwise).
- **`components`** — `{ verbal, somatic, material }` booleans (was a `"V, S, M"` string). A legacy string is coerced to flags.
- **`materials[]`** — one entry per material component: `{ text, cost, consumable }`. `cost` is in the campaign's gold unit (or `null`); set `consumable` for the ones the spell uses up (vs. a reusable focus like a 300-gp pearl). Only meaningful when `components.material` is `true` — a material component with an empty `materials[]` raises a warning. Blank material rows added in Edit mode are dropped when you leave it.
- **`damageType`** — the damage type, split out of `effect` (so `effect` keeps just the dice).
- **`higherLevels`** — the "At Higher Levels" upcast scaling text.
- **`description`** — the single multi-line free-text field (the old separate `notes` was merged into it).

CD incantesimi and bonus d'attacco are **derived** from `classes[].spellcasting.ability` + level (there is no top-level `spellcasting` field — it was a dead summary string and is gone). Keeps the table the user loves (what *you* roll vs what the *enemy* rolls + the wiki link), with optional richer `description`.

### `features[]`
```jsonc
[
  { "id": "pact-of-the-tome", "name": "Patto del Tomo", "source": "class",
    "level": 1, "link": "https://...",
    "description": "...", "uses": { "resourceId": "channel-divinity", "amount": 1 } }
]
```
`source`: `class | subclass | race | background | feat | item | custom`. `uses` optionally binds a feature to a `resources[]` entry so the UI can show/spend its charges inline.

**Anything that is a character feature goes here — Warlock invocations, Sorcerer metamagic options, Fighter maneuvers, fighting styles, etc.** They render in the **Attributi** tab grouped by `source`. Don't stash features in `customSections[]` (that renders in the Story tab and is only for genuinely freeform content — reminders, table notes, homebrew tables).

### `inventory`
```jsonc
{
  "items": [
    { "id": "potion-healing", "name": "Pozione di guarigione", "link": "https://...",
      "quantity": 3, "weight": 0.5, "value": 50, "equipped": false, "equippable": false, "attuned": false,
      "category": "consumable", "notes": "2d4+2" },
    // A WEAPON item carries its attack profiles (modes); they surface in the combat attacks view.
    { "id": "dagger", "name": "Pugnale", "category": "weapon", "quantity": 2, "equipped": true,
      "attacks": [
        { "label": "Mischia", "range": "Mischia", "attack": "+5", "effect": "1d4+3 perforanti" },
        { "label": "Lancio",  "range": "6/18 m",  "attack": "+5", "effect": "1d4+3 perforanti" }
      ] },
    // An ARMOR/SHIELD item carries its AC contribution; summed by the app when equipped.
    { "id": "studded", "name": "Cuoio borchiato", "category": "armor", "equipped": true,
      "ac": { "base": 12, "addDex": true, "dexCap": null, "bonus": 0, "label": "cuoio" } },
    { "id": "shield", "name": "Scudo", "category": "armor", "equipped": true,
      "ac": { "base": null, "bonus": 2, "label": "scudo" } }
  ],
  "currencies": { "pp": 0, "gp": 120, "ep": 0, "sp": 5, "cp": 0 },
  "notes": ["..."]
}
```
`quantity`, `equipped`, and `currencies` are live. `currencies` keys are open (add `ep`, homebrew coins…). `category` (open string: `weapon | armor | consumable | ammo | component | alchemy | treasure | gear`…) drives grouping in the Inventario tab and surfaces combat-relevant items (ammo/consumable) in the Gioco tab. A weapon's `attacks[]` and an armor/shield's `ac` are how those items feed the combat view and the derived AC. `equippable` (default `true`) is structural — it says whether an item *can* ever be worn/wielded at all; set it `false` on consumables, treasure, and other items that should never show an Equip button.

### `origin`, `narrative`
```jsonc
"origin": { "raceTraits": [ {"name":"Eredità infernale","description":"...","link":"..."} ],
            "backgroundFeature": {"name":"Ricercatore","description":"...","link":"..."} },
"narrative": { "personality": [...], "ideals": [...], "bonds": [...], "flaws": [...],
               "appearance": [...], "backstory": [...], "notes": [...] }
```
Languages are **not** here — they live in `proficiencies.languages` (their single home). A purely mechanical racial defense (resistance, darkvision) is better expressed in `defenses`/`senses`; keep `raceTraits` for narrative/feature-style traits.

### `customSections[]` — the freedom escape hatch
Anything the schema didn't anticipate, rendered by a layout hint.
```jsonc
[
  { "id": "components-pouch", "title": "Componenti materiali", "layout": "table",
    "link": null,
    "columns": ["Componente", "Per incantesimo", "Note"],
    "items": [ { "Componente": "Zolfo", "Per incantesimo": "Palla di fuoco", "Note": "consumato" } ] },
  { "id": "downtime", "title": "Attività di downtime", "layout": "checklist",
    "items": [ { "label": "Crea pergamena", "done": false } ] }
]
```
`layout`: `text | list | checklist | keyValue | cards | table`. The renderer has one component per layout kind — so custom sections need **zero** code to appear.

### `actions[]` — rests & custom buttons (formula-driven)
```jsonc
[
  { "id": "spend-hit-die", "label": "Spendi Dado Vita", "kind": "custom",
    "info": "Recupera 1d8 + mod. Costituzione, consuma un Dado Vita.",
    "formulas": [
      "combat.hp.current = combat.hp.current + 1d8 + abilities.con.mod",
      "combat.hp.hitDiceRemaining = combat.hp.hitDiceRemaining - 1"
    ] }
]
```
`kind`: `shortRest | longRest | custom`. A `shortRest`/`longRest` action fires (after the built-in reset) when that rest button is pressed; a `custom` action gets its own button. Each **formula** is `path = expression`:
- **left side** = a writable field path (`combat.hp.current`, `combat.hp.temp`, `combat.hp.hitDiceRemaining`, `resources.<id>.current`, …; array entries are addressed by their `id`).
- **right side** = a `+`/`-` sum of: numbers, dice (`NdM` / `dM`, rolled with a timestamp-seeded RNG), and readable paths — including the read-only virtuals `level`, `pb` / `proficiency`, `maxHitDice`, and `abilities.<id>.mod`.

The UI shows each action's formulae in a consultable "Formulas" info panel next to the rest/custom buttons. Engine: `src/model/formula.ts` (no `eval`, fixed `+`/`-` grammar only). Live fields are clamped to valid ranges on apply.

### `session` — purely ephemeral
```jsonc
{ "conditions": ["avvelenato"], "inspiration": false,
  "deathSaves": { "successes": 0, "failures": 0 }, "notes": "..." }
```

## 3. Validation tiers

The app validates on load but **never refuses to render**:
1. **Schema (shape)** — types/enums via Zod. Failures → "issues" panel, app still loads with defaults.
2. **Rules (5e consistency)** — e.g. proficiency bonus vs level, ability scores in range, spell levels vs available slots, multiclass prerequisites. These are *warnings*, surfaced by the in-app validator and the "validate" prompt, which can propose fixes on confirmation.
3. **Derived recompute** — modifiers/DC/bonuses recomputed; stored values that disagree are flagged, not trusted.

## 4. Migration

`src/schema/migrate.ts` upgrades older files in memory on load (persisted only on a real save). It is version-aware: a v1 file goes `1.0.0 → 2.0.0 → 2.1.0`; a `2.0.0` file just takes the minor step. `needsMigration` compares the full version (not only the major), so a `2.0.0` file is correctly flagged as behind.

### `2.0.0 → 2.1.0` (spells)
- `castingTime` string → `{ type, value, condition }` (`"1 bonus action"` → `{type:"bonus"}`, `"10 minutes"` → `{type:"time", value:"10 minutes"}`, a reaction's trailing trigger → `condition`).
- `components` string → `{ verbal, somatic, material }`; any material detail in a trailing parenthetical (`"V, S, M (a pearl worth 300 gp)"`) is lifted into `materials[]`, parsing a `… gp/mo` cost and a `consumable` hint. The old per-spell `notes` field is folded into `description`.
- `ritual`, `damageType`, `higherLevels` default in via the schema. Unmigrated/hand-edited string values for `castingTime`/`components` are also coerced by the schema itself, so an old file never hard-fails.

### `1.0.0 → 2.0.0` (key mappings from v1)
- `build.baseStats`/`abilities` (string scores, `"+0"` modifiers) → `abilities` object (numeric, derived modifiers).
- `session.resources.slots` dict (`{total, used}`) → `resources[]` entries (`{max, current}`, `category:"spellSlot"`), with `arrows` → a `category:"ammo"` resource.
- `combat.spellcasting` summary string → if non-empty, kept losslessly as a `customSections` text block (the dead root `spellcasting` field is gone); `spellSections` entries gain optional `school/castingTime/components/duration/description`.
- v1 `origin.languages` → `proficiencies.languages` (languages' single home).
- `features.items` + `features.levelChecklist` → `features[]` (+ a `customSections` checklist if needed).
- `identity[]` label/value pairs → `identity` object + `classes[]`.
- Unknown fields preserved under the nearest section or `customSections`.

## 5. Worked example
The canonical v2 template is `characters/example-warlock/character.json` (it supersedes the prototype's `pg.example/` template). Additional fixtures — a non-caster (Fighter), a prepared caster (Cleric), a points caster (Sorcerer), and a multiclass — land in **M1**, each exercising a different mechanic and doubling as a test fixture.

## 6. Changing the schema

The Zod schema in `src/schema/character.ts` is the source of truth, but a field never lives there alone. When you add, rename, or remove one, walk this checklist so the JSON, the UI, the docs, and the prompts stay in lockstep — they drift silently otherwise (the JSON Schema export and `meta`/derived values are the only things that update themselves).

- **`src/schema/character.ts`** — the Zod field itself (with a default, so a minimal character still validates). The JSON Schema (`jsonSchema.ts`) and the `Character` type regenerate from it automatically.
- **`src/schema/derive.ts`** — if the value is *computed* (don't also store it), add/adjust the derivation here instead of a stored field.
- **`src/schema/validate.ts`** — add an `IssueCode` + rule check if the field has a 5e consistency rule worth flagging.
- **`src/schema/migrate.ts`** (+ `migrate.test.ts`) — map the field from v1 and from any older v2 shape; keep it lossless. Add an assertion.
- **`src/model/factories.ts`** (+ `factories.test.ts`) — if it's (or lives in) an add-able list entry, the blank-entry factory must include it so a freshly-added row validates clean.
- **UI** — the read view and the Edit-mode editor in the relevant `src/render/*Section.tsx`; wire a brand-new section into `src/render/tabs.tsx` (and `getVisibleTabs`/`TabContent` if it can be empty).
- **`src/i18n/useI18n.ts`** — EN **and** IT keys for every new label/placeholder (UI chrome is never hardcoded).
- **Example characters** — `characters/example-*/character.json`; showcase a non-trivial field in `example-warlock` (the canonical template). `characters.test.ts` loads them all and asserts zero issues.
- **Docs** — this file (§1 top-level list, §2 the section, §4 migration note), `docs/UI.md` (tab/section), and the README "Where each 5e concept lives" table.
- **Prompts** — the data-contract bullets in `src/prompts/prompts.ts` **and** their mirror in `docs/PROMPTS.md`, plus `src/ui/HelpPage.tsx` (EN+IT) and the `.github/agents/*.agent.md` seed prompts.
- **Verify** — `npm run typecheck && npm test && npm run build`, then exercise the field in the live preview in both Play and Edit modes.

Keep it SRD-only: never bake a commercial sourcebook's content into schema defaults, examples, prompts, or docs (generic 5e mechanics terminology is fine; proprietary creative content is not).
