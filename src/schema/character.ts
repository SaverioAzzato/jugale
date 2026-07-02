import { z } from "zod";

/**
 * character.json schema v2.1.0 — the contract documented in docs/SCHEMA.md.
 *
 * Conventions:
 * - Every section has a default so a minimal `{ meta: { name } }` validates.
 * - `.passthrough()` everywhere: unknown keys are preserved, never dropped.
 * - We store inputs, not outputs: modifiers / proficiency bonus / DCs are derived
 *   (see derive.ts), with optional `*Override` escape hatches for homebrew.
 */

export const SCHEMA_VERSION = "2.1.0";

const link = z.string().nullable().optional();
const strings = z.array(z.string()).default([]);

export const AbilityId = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
export type AbilityId = z.infer<typeof AbilityId>;

const AbilityScore = z
  .object({
    score: z.number().int().min(1).max(30).default(10),
    saveProficient: z.boolean().default(false),
    modifierOverride: z.number().int().nullable().default(null),
  })
  .passthrough();

const Abilities = z
  .object({
    str: AbilityScore.default({}),
    dex: AbilityScore.default({}),
    con: AbilityScore.default({}),
    int: AbilityScore.default({}),
    wis: AbilityScore.default({}),
    cha: AbilityScore.default({}),
  })
  .default({});

/**
 * A rules guide in scope for this character: a bare name (e.g. "SRD") or, for niche
 * guides, `{ name, url }` where `url` is the base wiki URL the assistant may reference.
 */
const RulesetEntry = z.union([
  z.string(),
  z
    .object({ name: z.string(), url: z.string().optional() })
    .passthrough(),
]);

const Meta = z
  .object({
    name: z.string().min(1),
    player: z.string().default(""),
    summary: z.string().default(""),
    // No image fields: the app derives the portrait from the folder's images/ (first
    // alphabetically) — the JSON never references image paths. Legacy `portrait` keys are
    // preserved by .passthrough() but ignored.
    ruleset: z
      .array(RulesetEntry)
      .default(["SRD"])
      .describe(
        "Rules guides in scope for this character. Default is the freely-licensed SRD only; " +
          "each entry is a name string or { name, url } for a guide's base wiki URL. Adding other " +
          "sourcebooks is the user's own choice and licensing responsibility — only reference content " +
          "that is SRD or otherwise free to access/scrape under its terms of use.",
      ),
    tags: strings,
  })
  .passthrough();

const Identity = z
  .object({
    race: z.string().default(""),
    lineage: z.string().default(""),
    background: z.string().default(""),
    alignment: z.string().default(""),
    size: z.string().default(""),
    age: z.string().default(""),
    link,
  })
  .passthrough()
  .default({});

const ClassSpellcasting = z
  .object({
    ability: AbilityId.nullable().default(null),
    // known = spells known (sorcerer/bard/warlock…), prepared = prepares a daily list
    // (cleric/druid/wizard…), none = non-caster. There is no separate `prepares` flag.
    type: z.enum(["known", "prepared", "none"]).default("none"),
    slotProgression: z.enum(["full", "half", "third", "warlock", "none"]).default("none"),
  })
  .passthrough()
  .default({});

const ClassEntry = z
  .object({
    name: z.string().default(""),
    subclass: z.string().default(""),
    level: z.number().int().min(1).max(20).default(1),
    hitDie: z.string().default(""),
    link,
    spellcasting: ClassSpellcasting,
  })
  .passthrough();

const Skill = z
  .object({
    id: z.string(),
    proficient: z.boolean().default(false),
    expertise: z.boolean().default(false),
    modifierOverride: z.number().int().nullable().default(null),
  })
  .passthrough();

const Proficiencies = z
  .object({
    proficiencyBonusOverride: z.number().int().nullable().default(null),
    skills: z.array(Skill).default([]),
    languages: strings,
    tools: strings,
    armor: strings,
    weapons: strings,
  })
  .passthrough()
  .default({});

/**
 * Special senses (darkvision, blindsight, tremorsense, truesight…). Free strings so a range
 * fits naturally, e.g. "Darkvision 18 m". Passive Perception is NOT here — it's derived from
 * the Perception skill (see derive.ts) and shown with the skills.
 */
const Senses = strings;

/**
 * Damage/condition defenses, kept out of features[] so they have one clear home. Each is a
 * free string list, e.g. defenses.resistances = ["fire", "poison"]. The app never computes
 * them — it just displays them in the Attributes tab.
 */
const Defenses = z
  .object({
    resistances: strings,
    immunities: strings,
    vulnerabilities: strings,
    conditionImmunities: strings,
  })
  .passthrough()
  .default({});

const Hp = z
  .object({
    max: z.number().int().min(0).default(0),
    current: z.number().int().default(0),
    temp: z.number().int().min(0).default(0),
    hitDiceRemaining: z.number().int().min(0).default(0),
  })
  .passthrough()
  .default({});

const Attack = z
  .object({
    name: z.string().default(""),
    link,
    level: z.string().default(""),
    range: z.string().default(""),
    attack: z.string().default(""),
    defense: z.string().default(""),
    effect: z.string().default(""),
    notes: z.string().default(""),
  })
  .passthrough();

const Combat = z
  .object({
    armorClass: z.number().int().default(10),
    // Manual AC that wins over any armor-derived value (see derive.ts → derivedArmorClass).
    armorClassOverride: z.number().int().nullable().default(null),
    initiativeOverride: z.number().int().nullable().default(null),
    speed: z.object({ walk: z.number().default(30) }).passthrough().default({}),
    hp: Hp,
    attacks: z
      .array(Attack)
      .default([])
      .describe(
        "Innate / item-less attacks ONLY (breath weapon, unarmed strike, natural weapons). " +
          "Weapon attacks live on the inventory item (inventory.items[].attacks) and are merged " +
          "into the attacks view at render time. NEVER put a spell here — spells live only in " +
          "spellSections[], or they would show twice.",
      ),
  })
  .passthrough()
  .default({});

const Resource = z
  .object({
    id: z.string(),
    label: z.string().default(""),
    category: z
      .enum(["spellSlot", "points", "dice", "charges", "ammo", "custom"])
      .default("custom")
      .describe(
        "The generic tracker kind. Model ANYTHING spent/recovered as a resource (spell slots of " +
          "any name, pact magic, ki, rage, sorcery points, channel divinity, ammo…); never hardcode " +
          "a class-specific field.",
      ),
    max: z.number().int().min(0).default(0),
    current: z.number().int().min(0).default(0).describe("Live play-state: remaining uses; mutated during play."),
    level: z.number().int().min(0).max(9).nullable().default(null).describe("Only meaningful for category 'spellSlot': which spell level these slots cast."),
    resetOn: z
      .enum(["shortRest", "longRest", "dawn", "manual", "none"])
      .default("manual")
      .describe("Which rest/event restores this resource; drives the rest buttons."),
    link,
  })
  .passthrough();

/** How long a spell takes to cast. `value` carries the amount for `type:"time"`
 *  ("10 minutes"); `condition` carries the trigger for `type:"reaction"`. */
const CastingTime = z
  .object({
    type: z.enum(["action", "bonus", "reaction", "time"]).default("action"),
    value: z.string().default(""),
    condition: z.string().default(""),
  })
  .passthrough();
export type SpellCastingTime = z.infer<typeof CastingTime>;

/** Turn a legacy free-string casting time ("1 bonus action", "10 minutes") into the
 *  structured object. Exported so the migration reuses the exact same parsing. */
export function parseCastingTime(raw: unknown): SpellCastingTime {
  const s = String(raw ?? "").trim();
  if (!s) return { type: "action", value: "", condition: "" };
  if (/bonus/i.test(s)) return { type: "bonus", value: "", condition: "" };
  if (/reaction/i.test(s)) {
    const m = s.match(/reaction\b[\s,]*(?:which you take\s+)?(.*)$/i);
    return { type: "reaction", value: "", condition: (m?.[1] ?? "").trim() };
  }
  if (/^\s*(?:1\s+)?action\s*$/i.test(s)) return { type: "action", value: "", condition: "" };
  return { type: "time", value: s, condition: "" };
}

/** V / S / M component flags. */
const Components = z
  .object({
    verbal: z.boolean().default(false),
    somatic: z.boolean().default(false),
    material: z.boolean().default(false),
  })
  .passthrough();
export type SpellComponents = z.infer<typeof Components>;

/** Parse a legacy component string ("V, S, M") into flags. Reused by the migration. */
export function parseComponents(raw: unknown): SpellComponents {
  const up = String(raw ?? "").toUpperCase();
  return { verbal: /\bV\b/.test(up), somatic: /\bS\b/.test(up), material: /\bM\b/.test(up) };
}

/** One material component. `cost` is in the campaign's gold unit; `consumable` marks
 *  the ones the spell uses up (vs. a reusable focus like a 300-gp pearl). */
const SpellMaterial = z
  .object({
    text: z.string().default(""),
    cost: z.number().nullable().default(null),
    consumable: z.boolean().default(false),
  })
  .passthrough();
export type SpellMaterial = z.infer<typeof SpellMaterial>;

const Spell = z
  .object({
    name: z.string().default(""),
    link,
    level: z.string().default(""),
    school: z.string().default(""),
    // Tolerant: a stray legacy string is coerced instead of failing the whole character.
    castingTime: z
      .preprocess((v) => (typeof v === "string" ? parseCastingTime(v) : v), CastingTime)
      .default({ type: "action", value: "", condition: "" }),
    ritual: z.boolean().default(false),
    range: z.string().default(""),
    area: z.string().default(""),
    components: z
      .preprocess((v) => (typeof v === "string" ? parseComponents(v) : v), Components)
      .default({ verbal: false, somatic: false, material: false }),
    materials: z.array(SpellMaterial).default([]),
    duration: z.string().default(""),
    concentration: z.boolean().default(false),
    attack: z.string().default(""),
    defense: z.string().default(""),
    effect: z.string().default(""),
    damageType: z.string().default(""),
    higherLevels: z.string().default(""),
    // description is the single free-text field (any old `notes` is merged in on migration).
    description: z.string().default(""),
    prepared: z.boolean().default(true),
  })
  .passthrough();

const SpellSection = z
  .object({
    id: z.string().default(""),
    title: z.string().default(""),
    entries: z.array(Spell).default([]),
  })
  .passthrough();

const Feature = z
  .object({
    id: z.string().default(""),
    name: z.string().default(""),
    source: z
      .enum(["class", "subclass", "race", "background", "feat", "item", "custom"])
      .default("custom")
      .describe(
        "Where the feature comes from; the Attributi tab groups by this. EVERY class/subclass/race/" +
          "background/feat feature (invocations, metamagic, maneuvers, fighting styles…) goes in features[], " +
          "never in customSections[].",
      ),
    level: z.number().int().nullable().default(null),
    link,
    description: z.string().default(""),
    uses: z
      .object({ resourceId: z.string(), amount: z.number().int().default(1) })
      .passthrough()
      .nullable()
      .default(null),
  })
  .passthrough();

/** One way to attack with a weapon item: a mode (one-hand / two-hand / thrown…). */
const AttackProfile = z
  .object({
    label: z.string().default(""),
    range: z.string().default(""),
    attack: z.string().default(""),
    defense: z.string().default(""),
    effect: z.string().default(""),
    notes: z.string().default(""),
  })
  .passthrough();

/**
 * The AC an armor/shield item contributes while equipped. The renderer never knows 5e
 * armor rules — each item declares its own contribution and the app sums equipped ones
 * (see derive.ts → derivedArmorClass). `base` set ⇒ this is body armor (or an unarmored
 * formula like Monk/Barbarian); `base` null + `bonus` ⇒ an additive piece (shield, ring).
 */
const ArmorAc = z
  .object({
    base: z.number().int().nullable().default(null),
    addDex: z.boolean().default(false),
    dexCap: z.number().int().nullable().default(null),
    bonus: z.number().int().default(0),
    label: z.string().default(""),
  })
  .passthrough();

const Item = z
  .object({
    id: z.string().default(""),
    name: z.string().default(""),
    link,
    quantity: z.number().int().min(0).default(1),
    weight: z.number().min(0).default(0),
    value: z.number().min(0).nullable().default(null),
    equipped: z.boolean().default(false),
    equippable: z
      .boolean()
      .default(true)
      .describe("Whether this item can ever be worn/wielded at all. Set false on consumables, treasure, etc. so no Equip button shows."),
    attuned: z.boolean().default(false),
    category: z
      .string()
      .default("")
      .describe("Open string (weapon | armor | consumable | ammo | component | alchemy | treasure | gear…). Drives Inventario grouping and surfaces ammo/consumable in the Gioco tab."),
    notes: z.string().default(""),
    attacks: z
      .array(AttackProfile)
      .default([])
      .describe("A weapon item's attack profiles (modes: one-hand / two-hand / thrown…); they surface in the combat attacks view."),
    ac: ArmorAc.nullable().default(null).describe("An armor/shield item's AC contribution while equipped; the app sums equipped contributions (never compute AC by hand)."),
  })
  .passthrough();

const Inventory = z
  .object({
    items: z.array(Item).default([]),
    currencies: z.record(z.string(), z.number()).default({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }),
    notes: strings,
  })
  .passthrough()
  .default({});

const NamedDesc = z
  .object({ name: z.string().default(""), description: z.string().default(""), link })
  .passthrough();

const Origin = z
  .object({
    raceTraits: z.array(NamedDesc).default([]),
    backgroundFeature: NamedDesc.nullable().default(null),
    // Languages are a proficiency: they live in `proficiencies.languages`, not here.
  })
  .passthrough()
  .default({});

const Narrative = z
  .object({
    personality: strings,
    ideals: strings,
    bonds: strings,
    flaws: strings,
    appearance: strings,
    backstory: strings,
    notes: strings,
  })
  .passthrough()
  .default({});

const CustomSection = z
  .object({
    id: z.string().default(""),
    title: z.string().default(""),
    layout: z.enum(["text", "list", "checklist", "keyValue", "cards", "table"]).default("text"),
    link,
    columns: z.array(z.string()).default([]),
    content: z.string().default(""),
    items: z.array(z.any()).default([]),
  })
  .passthrough();

/**
 * A registered action: rest perks or custom buttons. `formulas` are `path = expr`
 * strings evaluated by src/model/formula.ts (field paths + numbers + NdM dice).
 * `kind` shortRest/longRest actions also fire when that rest button is pressed.
 */
const Action = z
  .object({
    id: z.string().default(""),
    label: z.string().default(""),
    kind: z.enum(["shortRest", "longRest", "custom"]).default("custom"),
    formulas: z
      .array(z.string())
      .default([])
      .describe(
        "Each is `path = expression`: left = a writable field path (combat.hp.current, resources.<id>.current…); " +
          "right = a +/- sum of numbers, NdM dice, and readable paths incl. virtuals level, pb, maxHitDice, abilities.<id>.mod. " +
          "E.g. 'combat.hp.current = combat.hp.current + 1d8 + abilities.con.mod'.",
      ),
    info: z.string().default(""),
  })
  .passthrough();

const Session = z
  .object({
    conditions: strings,
    inspiration: z.boolean().default(false),
    deathSaves: z
      .object({
        successes: z.number().int().min(0).max(3).default(0),
        failures: z.number().int().min(0).max(3).default(0),
      })
      .passthrough()
      .default({}),
    notes: z.string().default(""),
  })
  .passthrough()
  .default({});

export const CharacterSchema = z
  .object({
    schemaVersion: z.string().default(SCHEMA_VERSION),
    meta: Meta,
    identity: Identity,
    classes: z.array(ClassEntry).default([]),
    abilities: Abilities,
    proficiencies: Proficiencies,
    senses: Senses,
    defenses: Defenses,
    combat: Combat,
    resources: z.array(Resource).default([]),
    spellSections: z.array(SpellSection).default([]),
    features: z.array(Feature).default([]),
    inventory: Inventory,
    origin: Origin,
    narrative: Narrative,
    customSections: z.array(CustomSection).default([]),
    actions: z.array(Action).default([]),
    session: Session,
  })
  .passthrough();

export type Character = z.infer<typeof CharacterSchema>;
export type Resource = z.infer<typeof Resource>;
export type SpellEntry = z.infer<typeof Spell>;
export type ClassEntry = z.infer<typeof ClassEntry>;
export type Item = z.infer<typeof Item>;
export type AttackProfile = z.infer<typeof AttackProfile>;
export type AttackEntry = z.infer<typeof Attack>;
export type Action = z.infer<typeof Action>;
