import type { AbilityId, Character } from "./character";

/** D&D 5e derived values. The JSON stores inputs; these compute the outputs. */

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function totalLevel(character: Character): number {
  return character.classes.reduce((sum, c) => sum + (c.level ?? 0), 0);
}

export function proficiencyBonus(character: Character): number {
  const override = character.proficiencies.proficiencyBonusOverride;
  if (override != null) return override;
  const level = Math.max(1, totalLevel(character));
  return Math.floor((level - 1) / 4) + 2;
}

export function abilityModifierFor(character: Character, id: AbilityId): number {
  const ability = character.abilities[id];
  if (ability.modifierOverride != null) return ability.modifierOverride;
  return abilityModifier(ability.score);
}

export function savingThrowBonus(character: Character, id: AbilityId): number {
  const mod = abilityModifierFor(character, id);
  return mod + (character.abilities[id].saveProficient ? proficiencyBonus(character) : 0);
}

export function spellSaveDc(character: Character, ability: AbilityId): number {
  return 8 + proficiencyBonus(character) + abilityModifierFor(character, ability);
}

export function spellAttackBonus(character: Character, ability: AbilityId): number {
  return proficiencyBonus(character) + abilityModifierFor(character, ability);
}
