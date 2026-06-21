import type { AbilityId, Character } from "../schema";
import { abilityModifierFor, proficiencyBonus } from "../schema";

/** The 18 standard 5e skills, each tied to an ability. */
export interface SkillDef {
  id: string;
  label: string;
  ability: AbilityId;
}

export const SKILLS: SkillDef[] = [
  { id: "acrobatics", label: "Acrobazia", ability: "dex" },
  { id: "animal-handling", label: "Addestrare Animali", ability: "wis" },
  { id: "arcana", label: "Arcano", ability: "int" },
  { id: "athletics", label: "Atletica", ability: "str" },
  { id: "deception", label: "Inganno", ability: "cha" },
  { id: "history", label: "Storia", ability: "int" },
  { id: "insight", label: "Intuizione", ability: "wis" },
  { id: "intimidation", label: "Intimidire", ability: "cha" },
  { id: "investigation", label: "Indagare", ability: "int" },
  { id: "medicine", label: "Medicina", ability: "wis" },
  { id: "nature", label: "Natura", ability: "int" },
  { id: "perception", label: "Percezione", ability: "wis" },
  { id: "performance", label: "Intrattenere", ability: "cha" },
  { id: "persuasion", label: "Persuasione", ability: "cha" },
  { id: "religion", label: "Religione", ability: "int" },
  { id: "sleight-of-hand", label: "Rapidità di Mano", ability: "dex" },
  { id: "stealth", label: "Furtività", ability: "dex" },
  { id: "survival", label: "Sopravvivenza", ability: "wis" },
];

const normalize = (id: string): string => id.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface SkillState {
  proficient: boolean;
  expertise: boolean;
  bonus: number;
}

/** Resolve a character's proficiency/expertise on a skill and compute its bonus. */
export function skillState(character: Character, def: SkillDef): SkillState {
  const entry = character.proficiencies.skills.find((s) => normalize(s.id) === normalize(def.id));
  const proficient = entry?.proficient ?? false;
  const expertise = entry?.expertise ?? false;

  if (entry?.modifierOverride != null) {
    return { proficient, expertise, bonus: entry.modifierOverride };
  }
  const pb = proficiencyBonus(character);
  let bonus = abilityModifierFor(character, def.ability);
  if (proficient) bonus += pb;
  if (expertise) bonus += pb;
  return { proficient, expertise, bonus };
}
