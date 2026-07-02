/**
 * Blank-entry factories for Edit mode "add" actions. Each returns a plain object
 * matching that array entry's schema defaults (see src/schema/character.ts), so a
 * freshly-added row loads and renders cleanly. Entry types that the renderer keys by
 * `id` get a generated one. Types come from indexing the `Character` type, so they
 * never drift from the schema.
 */

import type { Character } from "../schema";

type ClassEntry = Character["classes"][number];
type Resource = Character["resources"][number];
type Spell = Character["spellSections"][number]["entries"][number];
type SpellSection = Character["spellSections"][number];
type Feature = Character["features"][number];
type Item = Character["inventory"]["items"][number];
type AttackProfile = Item["attacks"][number];
type InnateAttack = Character["combat"]["attacks"][number];
type CustomSection = Character["customSections"][number];
type Action = Character["actions"][number];
type Skill = Character["proficiencies"]["skills"][number];
type NamedDesc = Character["origin"]["raceTraits"][number];

/** Short unique id; `crypto.randomUUID` where available, else a random fallback. */
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export const newClass = (): ClassEntry => ({
  name: "",
  subclass: "",
  level: 1,
  hitDie: "",
  link: null,
  spellcasting: { ability: null, type: "none", slotProgression: "none" },
});

export const newResource = (): Resource => ({
  id: uid(),
  label: "",
  category: "custom",
  max: 0,
  current: 0,
  level: null,
  resetOn: "manual",
  link: null,
});

export const newSpell = (): Spell => ({
  name: "",
  link: null,
  level: "",
  school: "",
  castingTime: { type: "action", value: "", condition: "" },
  ritual: false,
  range: "",
  area: "",
  components: { verbal: false, somatic: false, material: false },
  materials: [],
  duration: "",
  concentration: false,
  attack: "",
  defense: "",
  effect: "",
  damageType: "",
  higherLevels: "",
  description: "",
  prepared: true,
});

/** A blank material component row (Edit mode "add material"). */
export const newSpellMaterial = (): Spell["materials"][number] => ({ text: "", cost: null, consumable: false });

export const newSpellSection = (): SpellSection => ({ id: uid(), title: "", entries: [] });

export const newFeature = (): Feature => ({
  id: uid(),
  name: "",
  source: "custom",
  level: null,
  link: null,
  description: "",
  uses: null,
});

export const newItem = (): Item => ({
  id: uid(),
  name: "",
  link: null,
  quantity: 1,
  weight: 0,
  value: null,
  equipped: false,
  equippable: true,
  attuned: false,
  category: "",
  notes: "",
  attacks: [],
  ac: null,
});

export const newAttackProfile = (): AttackProfile => ({
  label: "",
  range: "",
  attack: "",
  defense: "",
  effect: "",
  notes: "",
});

export const newInnateAttack = (): InnateAttack => ({
  name: "",
  link: null,
  level: "",
  range: "",
  attack: "",
  defense: "",
  effect: "",
  notes: "",
});

export const newCustomSection = (): CustomSection => ({
  id: uid(),
  title: "",
  layout: "text",
  link: null,
  columns: [],
  content: "",
  items: [],
});

export const newAction = (): Action => ({ id: uid(), label: "", kind: "custom", formulas: [], info: "" });

export const newSkill = (id: string): Skill => ({ id, proficient: false, expertise: false, modifierOverride: null });

export const newRaceTrait = (): NamedDesc => ({ name: "", description: "", link: null });
