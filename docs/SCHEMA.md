# Character Schema — `character.json` v2.0.0

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
  "schemaVersion": "2.0.0",
  "meta":         { ... },   // identity card of the *file*: name, player, portrait, ruleset
  "identity":     { ... },   // who the character is: race, background, alignment, age...
  "classes":      [ ... ],   // one entry per class → multiclass is native
  "abilities":    { ... },   // the six scores + save proficiency
  "proficiencies":{ ... },   // skills, saves, languages, tools, armor, weapons, prof. bonus override
  "combat":       { ... },   // AC, speed, initiative, HP, attacks
  "resources":    [ ... ],   // GENERIC tracked resources (slots of any name, ki, rage, arrows...)
  "spellcasting": { ... },   // caster summary (mostly derived) + per-class info
  "spellSections":[ ... ],   // the beloved spell tables, grouped freely
  "features":     [ ... ],   // class/race/background/feat features, with links
  "inventory":    { ... },   // items, currencies, attunement, notes
  "origin":       { ... },   // race traits, background feature, languages
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
  "name": "Christ Han-Desic",
  "player": "Saverio",
  "summary": "Tiefling Warlock, Patto del Tomo.",
  "portrait": { "src": "images/01-portrait.png", "alt": "..." },
  "ruleset": ["PHB", "Tasha", "Xanathar"],   // default; user-overridable, drives the prompts
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
    "spellcasting": { "ability": "cha", "type": "known", "prepares": false,
                      "slotProgression": "warlock" } }
]
```
- `type`: `known | prepared | none`. `slotProgression`: `full | half | third | warlock | none` — drives multiclass slot math.
- **Total level**, **proficiency bonus**, and the **multiclass spell-slot table** are derived from this array.

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
  "languages": ["Comune", "Infernale"],
  "tools": ["Strumenti da calligrafo"],
  "armor": ["Leggera"],
  "weapons": ["Semplici"]
}
```

### `combat`
```jsonc
{
  "armorClass": 13, "initiativeOverride": null, "speed": { "walk": 30, "fly": 0 },
  "hp": { "max": 38, "current": 38, "temp": 0, "hitDiceRemaining": 5 },
  "attacks": [
    { "name": "Eldritch Blast", "link": "https://...", "level": "Trucchetto",
      "range": "120 ft", "attack": "Attacco a distanza CA",          // "tiro che fai tu"
      "defense": "—",                                                // "tiro avversario"
      "effect": "1d10 forza × raggi", "notes": "Agonizing Blast: +CHA" }
  ]
}
```
`hp.current`/`hp.temp` are live. `attacks[]` reuses the same columns as spells so the table reads consistently.

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

### `spellcasting` + `spellSections[]`
```jsonc
"spellcasting": { "summary": "Cha · CD/attacco derivati dal livello incantatore" },
"spellSections": [
  { "id": "cantrips", "title": "Trucchetti", "entries": [
    { "name": "Eldritch Blast", "link": "https://...", "level": "0",
      "school": "Invocazione", "castingTime": "1 azione", "range": "120 ft",
      "components": "V, S", "duration": "Istantaneo", "concentration": false,
      "attack": "Attacco a distanza con incantesimo",   // tiro che fai TU
      "defense": "—",                                    // tiro che fa l'AVVERSARIO
      "effect": "1d10 danni da forza per raggio",
      "description": "Descrizione estesa di cosa succede, opzionale e più ricca.",
      "notes": "Scala a più raggi ai livelli 5/11/17", "prepared": true } ] }
]
```
CD incantesimi and bonus d'attacco are **derived** from `classes[].spellcasting.ability` + level. Keeps the table the user loves (what *you* roll vs what the *enemy* rolls + the wiki link), with optional richer `description`.

### `features[]`
```jsonc
[
  { "id": "pact-of-the-tome", "name": "Patto del Tomo", "source": "class",
    "level": 1, "link": "https://...",
    "description": "...", "uses": { "resourceId": "channel-divinity", "amount": 1 } }
]
```
`source`: `class | subclass | race | background | feat | item | custom`. `uses` optionally binds a feature to a `resources[]` entry so the UI can show/spend its charges inline.

### `inventory`
```jsonc
{
  "items": [ { "id": "potion-healing", "name": "Pozione di guarigione", "link": "https://...",
               "quantity": 3, "weight": 0.5, "equipped": false, "attuned": false,
               "category": "consumable", "notes": "2d4+2" } ],
  "currencies": { "pp": 0, "gp": 120, "ep": 0, "sp": 5, "cp": 0 },
  "notes": ["..."]
}
```
`quantity` and `currencies` are live. `currencies` keys are open (add `ep`, homebrew coins…).

### `origin`, `narrative`
```jsonc
"origin": { "raceTraits": [ {"name":"Resistenza infernale","description":"...","link":"..."} ],
            "backgroundFeature": {"name":"Ricercatore","description":"...","link":"..."},
            "languages": ["Comune","Infernale"] },
"narrative": { "personality": [...], "ideals": [...], "bonds": [...], "flaws": [...],
               "appearance": [...], "backstory": [...], "notes": [...] }
```

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

## 4. Migration `1.0.0 → 2.0.0`

`src/schema/migrations/` upgrades older files in memory on load (persisted only on a real save). Key mappings from v1:
- `build.baseStats`/`abilities` (string scores, `"+0"` modifiers) → `abilities` object (numeric, derived modifiers).
- `session.resources.slots` dict (`{total, used}`) → `resources[]` entries (`{max, current}`, `category:"spellSlot"`), with `arrows` → a `category:"ammo"` resource.
- `combat.spellcasting` summary string → derived; `spellSections` entries gain optional `school/castingTime/components/duration/description`.
- `features.items` + `features.levelChecklist` → `features[]` (+ a `customSections` checklist if needed).
- `identity[]` label/value pairs → `identity` object + `classes[]`.
- Unknown fields preserved under the nearest section or `customSections`.

## 5. Worked example
A complete `characters/example-warlock/character.json` ships as the canonical v2 template (replacing `pg.example/`), plus fixtures for a non-caster (Fighter), a prepared caster (Cleric), a points caster (Sorcerer), and a multiclass — each exercising a different mechanic and doubling as a test fixture.
