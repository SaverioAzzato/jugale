import { describe, it, expect } from "vitest";
import { CharacterSchema } from "./character";
import {
  abilityModifier,
  proficiencyBonus,
  totalLevel,
  spellSaveDc,
  spellAttackBonus,
  savingThrowBonus,
  maxHitDice,
  derivedArmorClass,
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

describe("maxHitDice", () => {
  it("equals total level across multiclass", () => {
    expect(maxHitDice(make({ classes: [{ name: "A", level: 3 }, { name: "B", level: 2 }] }))).toBe(5);
  });
});

describe("derivedArmorClass", () => {
  it("falls back to the stored armorClass when nothing is equipped with ac data", () => {
    const c = make({ combat: { armorClass: 15 } });
    expect(derivedArmorClass(c)).toEqual({ value: 15, breakdown: "" });
  });

  it("an explicit override always wins", () => {
    const c = make({
      combat: { armorClass: 10, armorClassOverride: 18 },
      inventory: { items: [{ name: "Cuoio", equipped: true, ac: { base: 11, addDex: true, label: "cuoio" } }] },
    });
    expect(derivedArmorClass(c)).toEqual({ value: 18, breakdown: "manuale" });
  });

  it("sums equipped light armor base + uncapped Dex, with a provenance breakdown", () => {
    const c = make({
      abilities: { dex: { score: 16 } }, // +3
      inventory: { items: [{ name: "Cuoio borchiato", equipped: true, ac: { base: 12, addDex: true, label: "cuoio" } }] },
    });
    expect(derivedArmorClass(c)).toEqual({ value: 15, breakdown: "cuoio 12 + des 3" });
  });

  it("caps Dex for medium armor and adds a shield bonus", () => {
    const c = make({
      abilities: { dex: { score: 18 } }, // +4, capped to +2
      inventory: {
        items: [
          { name: "Cotta", equipped: true, ac: { base: 14, addDex: true, dexCap: 2, label: "cotta" } },
          { name: "Scudo", equipped: true, ac: { bonus: 2, label: "scudo" } },
        ],
      },
    });
    expect(derivedArmorClass(c)).toEqual({ value: 18, breakdown: "cotta 14 + des 2 + scudo +2" });
  });

  it("ignores unequipped armor", () => {
    const c = make({
      combat: { armorClass: 10 },
      abilities: { dex: { score: 14 } },
      inventory: { items: [{ name: "Piastre", equipped: false, ac: { base: 18, label: "piastre" } }] },
    });
    expect(derivedArmorClass(c)).toEqual({ value: 10, breakdown: "" });
  });
});
