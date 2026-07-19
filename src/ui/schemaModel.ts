/**
 * A compact, hand-authored model of the character.json shape that drives the raw-JSON editor's
 * schema-aware autocompletion. It mirrors src/schema/character.ts, but describes only what
 * completions need — the fields, their order, enums, and which are nullable — and emits CodeMirror
 * snippet templates (with `${…}` tab stops) for:
 *   - the whole-document scaffold (empty doc),
 *   - a section skeleton (empty object/array),
 *   - a single key entry (adding one key to an object),
 *   - a new array element,
 *   - enum/boolean/null value options (at a value position).
 *
 * It is intentionally NOT auto-derived from the exported JSON Schema: we want curated starter
 * skeletons (a sensible character, not every default blanked out), and we want to stay lightweight
 * and CSP-safe. Drift only affects *suggestions* (never validation — that stays with loadCharacter),
 * and schemaModel.test.ts guards it by validating the generated scaffold against the real contract.
 *
 * Pure (no CodeMirror import) so it's unit-testable on its own; jsonEditor.ts consumes it.
 */
import { SCHEMA_VERSION } from "../schema";

export type SchemaNode =
  | { type: "string"; enum?: readonly string[]; default?: string; literal?: string }
  | { type: "number"; default?: number }
  | { type: "boolean"; default?: boolean }
  | { type: "null" }
  /** Value defaults to null; carries the shape used when the key is explicitly added. */
  | { type: "nullable"; inner: SchemaNode }
  | { type: "object"; fields: Record<string, SchemaNode> }
  | { type: "array"; item: SchemaNode };

// ---- tiny builders, to keep the model below readable ----
const str = (def = ""): SchemaNode => ({ type: "string", default: def });
const lit = (value: string): SchemaNode => ({ type: "string", literal: value });
/** Enum field: `values` in schema order (drives the suggestion list); `def` is the schema default
 *  (used in skeletons), which is not always the first value. */
const enums = (values: string[], def?: string): SchemaNode => ({ type: "string", enum: values, default: def ?? values[0] });
const num = (def = 0): SchemaNode => ({ type: "number", default: def });
const bool = (def = false): SchemaNode => ({ type: "boolean", default: def });
const nullable = (inner: SchemaNode): SchemaNode => ({ type: "nullable", inner });
const obj = (fields: Record<string, SchemaNode>): SchemaNode => ({ type: "object", fields });
const arr = (item: SchemaNode): SchemaNode => ({ type: "array", item });

const LINK: SchemaNode = nullable(str());
const STRINGS = arr(str());

const ABILITY = enums(["str", "dex", "con", "int", "wis", "cha"]);

const ABILITY_SCORE = obj({
  score: num(10),
  saveProficient: bool(false),
  modifierOverride: nullable(num()),
});

const SPELL = obj({
  name: str(),
  link: LINK,
  level: str(),
  school: str(),
  castingTime: obj({ type: enums(["action", "bonus", "reaction", "time"]), value: str(), condition: str() }),
  ritual: bool(false),
  range: str(),
  area: str(),
  components: obj({ verbal: bool(false), somatic: bool(false), material: bool(false) }),
  materials: arr(obj({ text: str(), cost: nullable(num()), consumable: bool(false) })),
  duration: str(),
  concentration: bool(false),
  attack: str(),
  defense: str(),
  effect: str(),
  damageType: str(),
  higherLevels: str(),
  description: str(),
  prepared: bool(true),
});

const ARMOR_AC = obj({
  base: nullable(num()),
  addDex: bool(false),
  dexCap: nullable(num()),
  bonus: num(0),
  label: str(),
});

const ITEM = obj({
  id: str(),
  name: str(),
  link: LINK,
  quantity: num(1),
  weight: num(0),
  value: nullable(num()),
  equipped: bool(false),
  equippable: bool(true),
  attuned: bool(false),
  category: str(),
  notes: str(),
  attacks: arr(obj({ label: str(), range: str(), attack: str(), defense: str(), effect: str(), notes: str() })),
  ac: nullable(ARMOR_AC),
});

const NAMED_DESC = obj({ name: str(), description: str(), link: LINK });

/** The full character contract, in schema order. See src/schema/character.ts. */
export const CHARACTER_MODEL: SchemaNode = obj({
  schemaVersion: lit(SCHEMA_VERSION),
  meta: obj({ name: str(), player: str(), summary: str(), ruleset: arr(str()), tags: STRINGS }),
  identity: obj({
    race: str(),
    lineage: str(),
    background: str(),
    alignment: str(),
    size: str(),
    age: str(),
    link: LINK,
  }),
  classes: arr(
    obj({
      name: str(),
      subclass: str(),
      level: num(1),
      hitDie: str(),
      link: LINK,
      spellcasting: obj({
        ability: nullable(ABILITY),
        type: enums(["known", "prepared", "none"], "none"),
        slotProgression: enums(["full", "half", "third", "warlock", "none"], "none"),
      }),
    }),
  ),
  abilities: obj({ str: ABILITY_SCORE, dex: ABILITY_SCORE, con: ABILITY_SCORE, int: ABILITY_SCORE, wis: ABILITY_SCORE, cha: ABILITY_SCORE }),
  proficiencies: obj({
    proficiencyBonusOverride: nullable(num()),
    skills: arr(obj({ id: str(), proficient: bool(false), expertise: bool(false), modifierOverride: nullable(num()) })),
    languages: STRINGS,
    tools: STRINGS,
    armor: STRINGS,
    weapons: STRINGS,
  }),
  senses: STRINGS,
  defenses: obj({ resistances: STRINGS, immunities: STRINGS, vulnerabilities: STRINGS, conditionImmunities: STRINGS }),
  combat: obj({
    armorClassOverride: nullable(num()),
    initiativeOverride: nullable(num()),
    speed: obj({ walk: num(30) }),
    hp: obj({ max: num(0), current: num(0), temp: num(0), hitDiceRemaining: num(0) }),
    attacks: arr(obj({ name: str(), link: LINK, level: str(), range: str(), attack: str(), defense: str(), effect: str(), notes: str() })),
  }),
  resources: arr(
    obj({
      id: str(),
      label: str(),
      category: enums(["spellSlot", "points", "dice", "charges", "ammo", "custom"], "custom"),
      max: num(0),
      current: num(0),
      level: nullable(num()),
      resetOn: enums(["shortRest", "longRest", "dawn", "manual", "none"], "manual"),
      link: LINK,
    }),
  ),
  spellSections: arr(obj({ id: str(), title: str(), entries: arr(SPELL) })),
  features: arr(
    obj({
      id: str(),
      name: str(),
      source: enums(["class", "subclass", "race", "background", "feat", "item", "custom"], "custom"),
      level: nullable(num()),
      link: LINK,
      description: str(),
      uses: nullable(obj({ resourceId: str(), amount: num(1) })),
    }),
  ),
  inventory: obj({
    items: arr(ITEM),
    currencies: obj({ pp: num(0), gp: num(0), ep: num(0), sp: num(0), cp: num(0) }),
    notes: STRINGS,
  }),
  origin: obj({ raceTraits: arr(NAMED_DESC), backgroundFeature: nullable(NAMED_DESC) }),
  narrative: obj({
    personality: STRINGS,
    ideals: STRINGS,
    bonds: STRINGS,
    flaws: STRINGS,
    appearance: STRINGS,
    backstory: STRINGS,
    notes: STRINGS,
  }),
  customSections: arr(
    obj({
      id: str(),
      title: str(),
      layout: enums(["text", "list", "checklist", "keyValue", "cards", "table"]),
      link: LINK,
      columns: STRINGS,
      content: str(),
      items: arr({ type: "null" }),
    }),
  ),
  actions: arr(obj({ id: str(), label: str(), kind: enums(["shortRest", "longRest", "custom"], "custom"), formulas: STRINGS, info: str() })),
  session: obj({
    conditions: STRINGS,
    inspiration: bool(false),
    deathSaves: obj({ successes: num(0), failures: num(0) }),
    notes: str(),
  }),
});

/** Keys omitted from generated skeletons (offered on demand via key-completion, but not pre-filled):
 *  escape-hatch overrides and optional links keep the starter clean. */
function skeletonOmit(key: string): boolean {
  return key === "link" || /Override$/.test(key);
}

// ---- snippet generation ------------------------------------------------------------------------
// Templates are authored at "column 0" with 2-space steps; CodeMirror re-indents continuation lines
// by the insertion line's indentation, so nested depth stays correct wherever a snippet lands.

interface RenderOpts {
  /** A generated id to bake into this object's `id` field (array elements get a real uid). */
  idValue?: string;
}

/** A leaf/`null`/nullable value as a snippet. Only empty strings become tab stops (`"${}"`, an
 *  anonymous CodeMirror field — bare `${}` are the only kind CM keeps distinct; `${N}`/`${name}`
 *  link fields together). Numbers/booleans/enum defaults are emitted as plain literals since they
 *  already carry a sensible value. Objects/arrays are the multi-line cases below. */
function renderScalar(node: SchemaNode): string {
  switch (node.type) {
    case "string":
      if (node.literal !== undefined) return JSON.stringify(node.literal);
      if (node.enum) return JSON.stringify(node.default ?? node.enum[0]);
      return node.default ? JSON.stringify(node.default) : '"${}"';
    case "number":
      return String(node.default ?? 0);
    case "boolean":
      return String(node.default ?? false);
    case "null":
      return "null";
    case "nullable":
      return "null";
    default:
      return "null";
  }
}

/** A node's value as a snippet, at indentation `ind` (the indent of the line it starts on).
 *  In this (skeleton) context nullable → null and arrays → empty; use fillArray/renderElement to
 *  populate an array the user is explicitly filling. */
function render(node: SchemaNode, ind: string, opts: RenderOpts = {}): string {
  if (node.type === "object") {
    const inner = ind + "  ";
    const lines: string[] = [];
    for (const [key, child] of Object.entries(node.fields)) {
      if (skeletonOmit(key)) continue;
      const value = key === "id" && opts.idValue !== undefined ? JSON.stringify(opts.idValue) : render(child, inner);
      lines.push(`${inner}${JSON.stringify(key)}: ${value}`);
    }
    return `{\n${lines.join(",\n")}\n${ind}}`;
  }
  if (node.type === "array") return "[]";
  return renderScalar(node);
}

/** An array populated with one element, at indentation `ind`. */
function fillArray(node: Extract<SchemaNode, { type: "array" }>, ind: string, opts: RenderOpts): string {
  const inner = ind + "  ";
  return `[\n${inner}${render(node.item, inner, opts)}\n${ind}]`;
}

/** The whole-document scaffold (empty doc). */
export function scaffoldSnippet(): string {
  return render(CHARACTER_MODEL, "");
}

/** Skeleton for an empty container: an object's fields, or an array with one element.
 *  `idValue` is baked into an element's `id` field when the array holds id-keyed objects. */
export function containerSkeletonSnippet(node: SchemaNode, opts: RenderOpts = {}): string {
  if (node.type === "array") return fillArray(node, "", opts);
  return render(node, "", opts);
}

/** A single `"key": value` entry (adding one key to an object). Nullable-object/array keys expand to
 *  their shape (adding `ac` scaffolds the AC object); other nullables and scalars use their default. */
export function keyEntrySnippet(child: SchemaNode, key: string): string {
  let value: string;
  if (child.type === "nullable" && (child.inner.type === "object" || child.inner.type === "array")) {
    value = render(child.inner, "");
  } else {
    value = render(child, "");
  }
  return `${JSON.stringify(key)}: ${value}`;
}

/** A new array element as a standalone snippet (adding to a non-empty array). */
export function elementEntrySnippet(item: SchemaNode, opts: RenderOpts = {}): string {
  return render(item, "", opts);
}

/** Whether an object node has an `id` string field (so callers know to generate a uid). */
export function hasIdField(node: SchemaNode): boolean {
  return node.type === "object" && node.fields.id?.type === "string";
}

export interface ValueOption {
  /** Literal JSON inserted (already quoted for strings). */
  insert: string;
  /** Display label in the completion list. */
  label: string;
}

/** Value suggestions at a value position: enum members, booleans, and `null` for nullables.
 *  Returns [] for free-form scalars (nothing useful to suggest). */
export function valueOptionsAt(node: SchemaNode): ValueOption[] {
  const out: ValueOption[] = [];
  const base = node.type === "nullable" ? node.inner : node;
  if (base.type === "string" && base.enum) {
    for (const v of base.enum) out.push({ insert: JSON.stringify(v), label: v });
  } else if (base.type === "boolean") {
    out.push({ insert: "true", label: "true" }, { insert: "false", label: "false" });
  }
  if (node.type === "nullable") out.push({ insert: "null", label: "null" });
  return out;
}

/** Ordered keys of an object node (for key-completion; caller filters out present ones). */
export function objectKeys(node: SchemaNode): string[] {
  return node.type === "object" ? Object.keys(node.fields) : [];
}

/** The child node for a key of an object node, if any. */
export function fieldNode(node: SchemaNode, key: string): SchemaNode | null {
  return node.type === "object" ? (node.fields[key] ?? null) : null;
}

/** Descend one path segment (object key or array item) for schema lookup by path. */
export function childForSegment(node: SchemaNode, seg: string | number): SchemaNode | null {
  const base = node.type === "nullable" ? node.inner : node;
  if (base.type === "object") return base.fields[String(seg)] ?? null;
  if (base.type === "array") return base.item;
  return null;
}
