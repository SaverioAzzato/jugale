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
  "name": "Esempio Warlock",
  "player": "Saverio",
  "summary": "Tiefling Warlock, Patto del Tomo.",
  "portrait": { "src": "images/01-portrait.png", "alt": "..." },
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

## 4. Migration `1.0.0 → 2.0.0`

`src/schema/migrations/` upgrades older files in memory on load (persisted only on a real save). Key mappings from v1:
- `build.baseStats`/`abilities` (string scores, `"+0"` modifiers) → `abilities` object (numeric, derived modifiers).
- `session.resources.slots` dict (`{total, used}`) → `resources[]` entries (`{max, current}`, `category:"spellSlot"`), with `arrows` → a `category:"ammo"` resource.
- `combat.spellcasting` summary string → derived; `spellSections` entries gain optional `school/castingTime/components/duration/description`.
- `features.items` + `features.levelChecklist` → `features[]` (+ a `customSections` checklist if needed).
- `identity[]` label/value pairs → `identity` object + `classes[]`.
- Unknown fields preserved under the nearest section or `customSections`.

## 5. Worked example
The canonical v2 template is `characters/example-warlock/character.json` (it supersedes the prototype's `pg.example/` template). Additional fixtures — a non-caster (Fighter), a prepared caster (Cleric), a points caster (Sorcerer), and a multiclass — land in **M1**, each exercising a different mechanic and doubling as a test fixture.
