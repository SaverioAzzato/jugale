import { describe, it, expect } from "vitest";
import { loadCharacter } from "../schema";
import {
  uid,
  newClass,
  newResource,
  newSpell,
  newSpellSection,
  newFeature,
  newItem,
  newInnateAttack,
  newCustomSection,
  newAction,
} from "./factories";

describe("factories — new entries are schema-clean", () => {
  it("uid produces distinct ids", () => {
    expect(uid()).not.toBe(uid());
  });

  // A character carrying one fresh entry of each kind must load with zero issues:
  // proof the factory defaults match the schema (no missing/invalid fields).
  it("a character built from factories validates without issues", () => {
    const raw = {
      meta: { name: "Factory Test" },
      classes: [newClass()],
      resources: [newResource()],
      spellSections: [{ ...newSpellSection(), entries: [newSpell()] }],
      features: [newFeature()],
      inventory: { items: [newItem()] },
      combat: { attacks: [newInnateAttack()] },
      customSections: [newCustomSection()],
      actions: [newAction()],
    };
    const { issues, ok } = loadCharacter(raw);
    expect(ok).toBe(true);
    expect(issues).toEqual([]);
  });

  it("a new class defaults to a level-1 non-caster", () => {
    const cl = newClass();
    expect(cl.level).toBe(1);
    expect(cl.spellcasting.ability).toBeNull();
    expect(cl.spellcasting.slotProgression).toBe("none");
  });
});
