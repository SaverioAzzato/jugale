import { describe, it, expect } from "vitest";
import { CharacterSchema } from "./character";
import {
  abilityModifier,
  proficiencyBonus,
  totalLevel,
  spellSaveDc,
  spellAttackBonus,
  savingThrowBonus,
} from "./derive";

const make = (over: Record<string, unknown> = {}) => CharacterSchema.parse({ meta: { name: "T" }, ...over });

describe("abilityModifier", () => {
  it("follows the 5e curve", () => {
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(17)).toBe(3);
    expect(abilityModifier(20)).toBe(5);
  });
});

describe("proficiencyBonus", () => {
  it("scales with total level", () => {
    expect(proficiencyBonus(make({ classes: [{ name: "X", level: 1 }] }))).toBe(2);
    expect(proficiencyBonus(make({ classes: [{ name: "X", level: 4 }] }))).toBe(2);
    expect(proficiencyBonus(make({ classes: [{ name: "X", level: 5 }] }))).toBe(3);
    expect(proficiencyBonus(make({ classes: [{ name: "X", level: 20 }] }))).toBe(6);
  });
  it("defaults to +2 with no classes and honours an override", () => {
    expect(proficiencyBonus(make())).toBe(2);
    expect(proficiencyBonus(make({ proficiencies: { proficiencyBonusOverride: 5 } }))).toBe(5);
  });
});

describe("totalLevel", () => {
  it("sums multiclass levels", () => {
    const c = make({ classes: [{ name: "A", level: 3 }, { name: "B", level: 2 }] });
    expect(totalLevel(c)).toBe(5);
  });
});

describe("spell math", () => {
  const warlock = make({ classes: [{ name: "Warlock", level: 5 }], abilities: { cha: { score: 17 } } });
  it("computes save DC and attack bonus from caster ability + PB", () => {
    // level 5 → PB +3, CHA 17 → +3 ⇒ DC 14, attack +6
    expect(spellSaveDc(warlock, "cha")).toBe(14);
    expect(spellAttackBonus(warlock, "cha")).toBe(6);
  });
});

describe("savingThrowBonus", () => {
  it("adds proficiency when proficient", () => {
    const c = make({ classes: [{ name: "X", level: 5 }], abilities: { cha: { score: 17, saveProficient: true }, str: { score: 8 } } });
    expect(savingThrowBonus(c, "cha")).toBe(6); // +3 mod +3 PB
    expect(savingThrowBonus(c, "str")).toBe(-1); // not proficient
  });
});
