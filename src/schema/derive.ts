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

/** Total Hit Dice a character has = total level (one per level). */
export function maxHitDice(character: Character): number {
  return totalLevel(character);
}

/**
 * Armor Class, derived without hardcoding 5e armor rules: each equipped armor/shield item
 * declares its own contribution (see character.ts → ArmorAc) and we sum them, exposing a
 * provenance breakdown (e.g. "leather 11 + dex 3 + shield 2"). Precedence:
 *   1. an explicit `combat.armorClassOverride` always wins ("manual");
 *   2. else, if any equipped item declares an `ac`, derive from those;
 *   3. else, fall back to the stored `combat.armorClass` (legacy / hand-set value).
 */
export function derivedArmorClass(character: Character): { value: number; breakdown: string } {
  const override = character.combat.armorClassOverride;
  if (override != null) return { value: override, breakdown: "manual" };

  const dex = abilityModifierFor(character, "dex");
  const equipped = character.inventory.items.filter((it) => it.equipped && it.ac != null);

  if (equipped.length === 0) {
    return { value: character.combat.armorClass, breakdown: "" };
  }

  let total = 0;
  const parts: string[] = [];

  for (const it of equipped) {
    const ac = it.ac!;
    const label = ac.label || it.name || "armor";
    if (ac.base != null) {
      total += ac.base;
      parts.push(`${label} ${ac.base}`);
      if (ac.addDex) {
        const applied = ac.dexCap != null ? Math.min(dex, ac.dexCap) : dex;
        total += applied;
        parts.push(`dex ${applied}`);
      }
    }
    if (ac.bonus) {
      total += ac.bonus;
      parts.push(`${label} ${ac.bonus >= 0 ? "+" : ""}${ac.bonus}`);
    }
  }

  return { value: total, breakdown: parts.join(" + ") };
}
