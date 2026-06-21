# UI design — character sheet makeover (M2)

> Status: **agreed design, pre-implementation** · Outcome of the guided makeover brainstorm.
> This is the structural/UX contract for the sheet. Visual identity (the "D&D Digital" skin) is deliberately **out of scope here** — it is decided later, purely through the centralized theme tokens (`src/theme/themes.css`), without touching the structure described below.

## Principles

1. **Lightweight, clean, uncluttered, simple to use.** Density is for *in-session play*, not decoration. When in doubt, cut.
2. **Generated entirely from `character.json`.** No hardcoded class/character content. The renderer never computes rules — it sums/derives only from inputs the data declares.
3. **Auto-hide on empty.** Every block/section renders only if the JSON has data for it. Missing fields fall back gracefully (empty or not rendered, whichever is cleaner) — the UI "demands the right amount" and no more.
4. **Tokens only.** All colors/spacing/radii/fonts come from theme tokens, so the visual pass later is pure token work.
5. **Works well on every device.** Phone, tablet, desktop — the layout prioritizes simplicity and one-handed reachability of the things touched most in play.

## Two modes

- **Play (default):** read + the live play-state mutations + *targeted* structural adds (add an item, add a spell individually).
- **Edit (later milestone):** a global toggle that unlocks comprehensive structural editing — forms for every field (level-up, scores, features, full item/weapon/spell editors).

Build the hybrid first (play + individual adds). The global Edit mode comes after.

## Live vs structural (unchanged contract)

Live play-state the app mutates continuously: `combat.hp.current`/`temp`, hit dice, `resources[].current`, `inventory.items[].quantity`, `inventory.items[].equipped`, `inventory.currencies.*`, `session.*` (conditions, inspiration, death saves). Everything else is structural (changes only on an explicit edit/level-up, or via GPT/hand-edit until Edit mode lands).

## Tabs

Four tabs; each auto-hides if it would have no content.

| Tab | Role | Blocks |
|---|---|---|
| **Gioco** | the table, in action | Vitals · Status (secondary) · Resources & slots + rests · Attacks · Spells · Consumables |
| **Attributi** | who they are, what they can do | Abilities + saves · Skills + passive perception · Proficiencies · Features & feats (by source) · Senses |
| **Inventario** | what they carry | Equipped (top) · Category sections · Currencies · Attunement · (optional) Encumbrance |
| **Storia** | where they come from | Bio · Personality · Background · Narrative · Portrait & gallery |

### Gioco

- **Vitals** — HP (current/max/temp) with quick Damage/Heal + fine ± steppers for HP and Temp; HP bar; Hit Dice (spendable); AC, Initiative, Speed. AC shows a small **provenance note** underneath (see AC model). All live.
- **Status (secondary, not front-and-center)** — active conditions as removable chips with an inline "+ condition" to add on the spot; inspiration; death saves shown **only when relevant** (e.g. HP at 0). Live.
- **Resources & slots** — generic `resources[]` as compact chips with inline ± (slots of any name, pact points, ki, etc.); **Short rest / Long rest** buttons right there. Rests are data-driven (see Rests). Live.
- **Attacks** — weapons (derived from inventory) + innate attacks, in one view (see Attacks model). A multi-profile weapon is an expandable row showing each mode (one-hand / two-hand / thrown). A weapon **not** flagged equipped is shown **dimmed but still visible**, with a reminder that switching costs an action.
- **Spells** — organized by `spellSections[]` (cantrips / by level / rituals / …). Each spell is a collapsed row (the numbers you say at the table: range · to-hit or save DC · damage) → tap → rich card (school, casting time, area, duration, concentration, components, a multi-line **description**, and the wiki **link**). Spell save DC / attack shown once.
- **Consumables** — a **filtered view** onto inventory items whose category is combat-relevant (ammo, consumable): arrows, potions, etc., with inline ± that mutate the same `inventory.items[].quantity`. No duplication.

### Attributi

(Mostly reference; structural. In Play mode read-only, editable in Edit mode.)

- **Abilities** — 6 scores + modifiers + saving throws (proficient highlighted).
- **Skills** — all 18 for reference (proficiency/expertise highlighted) + passive perception.
- **Proficiencies** — weapons, armor, tools, languages.
- **Features & feats** — grouped by `source` (class / subclass / race / background / feat). This is where Warlock invocations/suppliche, fighting styles, etc. live.
- **Senses** — darkvision, etc.

### Inventario

- **Equipped (top)** — filtered view on the `equipped` flag: worn armor + weapons in hand, each with a quick "Togli". Toggling equip updates the derived views (AC; attack availability dimming).
- **Category sections** — items grouped by `category` (weapon / armor / consumable / ammo / component / alchemy / treasure / gear…). The same `category` is what surfaces consumables/ammo in Gioco and powers "special inventories" (components, alchemy, crafting) as just more categories.
- An **item is a possession** (name, quantity [live], equipped [live], attuned, weight, value, description, link). A **weapon item additionally carries its attack profiles** (`attacks[]`), which feed the Gioco attacks list. An **armor/shield item carries its AC contribution** (see AC model). Individual add/remove + ± quantity in Play mode.
- **Currencies** — live.
- **Attunement** — 0–3 used indicator, derived from the `attuned` flag.
- **Encumbrance (optional)** — total weight vs carrying capacity (STR×15), shown **only if** items declare weights; hidden otherwise.

### Storia

(Narrative; read-only in Play, written in Edit mode.)

- **Bio** — alignment, age, height, weight, eyes/hair/skin, deity/faith.
- **Personality** — traits, ideals, bonds, flaws.
- **Background** + background feature.
- **Narrative** — backstory, allies, organizations/factions.
- **Portrait & gallery** — the character's `images/` folder with a lightbox (the prototype feature worth keeping); the active portrait also appears in the header across all tabs.

## Cross-cutting data model

These shape the schema (changes flagged for implementation, with migration).

- **`note` + `description` → one field.** A single multi-line free-text field per spell/attack/etc. (holds the wiki description *and* table annotations). Migration concatenates the old two.
- **Attacks.** Two sources, one view:
  - **Weapon attacks live on the item:** `inventory.items[].attacks[]`, each an attack profile (mode label, range/reach, to-hit, damage, properties). One weapon → 1+ profiles (melee/thrown, 1h/2h). Editing the weapon's name/link in one place reflects everywhere; the Gioco list is derived.
  - **Innate attacks** (breath weapon, unarmed strike, natural weapons — things with no item) live in `combat.attacks[]`, repurposed as the innate-only list.
  - The Gioco "Attacks" block is the union of both; weapons can be dimmed via the `equipped` flag.
- **AC.** The renderer does **not** know AC rules. Each armor/shield **item declares its own AC contribution** (base + Dex handling + bonus/malus). The app sums the contributions of *equipped* armor/shield items and renders a **provenance note** under the AC value — e.g. `cuoio 11 + des 3`, `no arm` (Monk), `ombra` (Warlock shadow armor). A manual `combat.armorClass` override always wins. Equipping/unequipping recomputes from the declared data. **GPT prompts (M3) must be instructed carefully to maintain these encodings** — noted in ROADMAP M3.
- **Resources & rests.** Rest mechanics are uniform across classes in 5e RAW; what varies is *which* resources reset, declared per-resource via `resetOn` (`shortRest`/`longRest`/`dawn`/`manual`/`none`). The rest buttons are a convenience macro applying these to the declared data (+ HP/Hit Dice rules on long rest) — **no class logic in code**, and the user can always adjust manually. **Hit Dice** are modeled as a resource (so "spend to heal on a short rest" is interactive).
- **Consumables / ammo.** A combat-relevant `category` (ammo, consumable) makes an inventory item surface in the Gioco consumables strip; the ± there mutate the single `inventory.items[].quantity`. One source, two views.
- **Equipped flag** drives the Inventario "Equipped" section and the dimming of non-equipped weapons' attacks in Gioco.

## Visual identity (deferred)

Out of scope for this doc. Decided later as a dedicated pass over `src/theme/themes.css` (+ a possible flagship theme, display font, iconography). Implementation must use tokens only so this stays a pure theme change.

## Suggested implementation order

1. **Schema + migration + tests** for the data-model changes above (note/description merge, `items[].attacks[]`, item AC contribution, item `category`/`weight`/`value`/`attuned`, Hit Dice resource). Everything else depends on these.
2. **Gioco** tab structure (vitals, status, resources+rests, attacks, spells, consumables).
3. **Inventario** (equipped section, category sections, equip→AC/dimming wiring).
4. **Attributi** + **Storia** (lighter; largely reorganizing what already renders).
5. Visual pass via theme tokens.
