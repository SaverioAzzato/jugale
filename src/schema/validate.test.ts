import { describe, it, expect } from "vitest";
import { loadCharacter } from "./validate";

describe("loadCharacter", () => {
  it("loads a minimal character with only a name", () => {
    const result = loadCharacter({ schemaVersion: "2.0.0", meta: { name: "Tav" } });
    expect(result.ok).toBe(true);
    expect(result.character.meta.name).toBe("Tav");
    expect(result.issues).toHaveLength(0);
  });

  it("fills defaults for omitted sections", () => {
    const { character } = loadCharacter({ meta: { name: "Tav" } });
    expect(character.abilities.str.score).toBe(10);
    expect(character.inventory.currencies.gp).toBe(0);
    expect(character.combat.armorClass).toBe(10);
    expect(character.senses).toEqual([]);
    expect(character.defenses).toEqual({
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      conditionImmunities: [],
    });
  });

  it("accepts populated senses and defenses", () => {
    const { character, issues } = loadCharacter({
      meta: { name: "Tav" },
      senses: ["Darkvision 18 m"],
      defenses: { resistances: ["fire"], conditionImmunities: ["frightened"] },
    });
    expect(issues).toHaveLength(0);
    expect(character.senses).toEqual(["Darkvision 18 m"]);
    expect(character.defenses.resistances).toEqual(["fire"]);
    expect(character.defenses.vulnerabilities).toEqual([]); // missing keys still default
    expect(character.defenses.conditionImmunities).toEqual(["frightened"]);
  });

  it("never throws and stays renderable on invalid input (missing name)", () => {
    const result = loadCharacter({ schemaVersion: "2.0.0", meta: {} });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.severity === "error" && i.code === "schema")).toBe(true);
    expect(result.character.meta.name).toBe("Personaggio"); // fallback, still renderable
  });

  it("preserves unknown keys (passthrough)", () => {
    const { character } = loadCharacter({ meta: { name: "Tav" }, homebrew: { luck: 3 } });
    expect((character as Record<string, unknown>).homebrew).toEqual({ luck: 3 });
  });

  it("accepts meta.ruleset as plain strings or { name, url } objects", () => {
    const { character, ok } = loadCharacter({
      meta: { name: "Tav", ruleset: ["SRD", { name: "MyWiki", url: "https://wiki.example" }] },
    });
    expect(ok).toBe(true);
    expect(character.meta.ruleset[0]).toBe("SRD");
    expect(character.meta.ruleset[1]).toEqual({ name: "MyWiki", url: "https://wiki.example" });
  });

  it("warns when a resource is overspent", () => {
    const result = loadCharacter({
      meta: { name: "Tav" },
      resources: [{ id: "ki", label: "Ki", max: 3, current: 5 }],
    });
    expect(result.ok).toBe(true);
    const issue = result.issues.find((i) => i.path === "resources.ki");
    expect(issue?.severity).toBe("warning");
    expect(issue?.code).toBe("resourceOverspent");
    expect(issue?.params).toEqual({ label: "Ki", current: 5, max: 3 });
  });

  it("warns on a proficiency bonus override that disagrees with level", () => {
    const result = loadCharacter({
      meta: { name: "Tav" },
      classes: [{ name: "Wizard", level: 1 }],
      proficiencies: { proficiencyBonusOverride: 6 },
    });
    const issue = result.issues.find((i) => i.path === "proficiencies.proficiencyBonusOverride");
    expect(issue?.code).toBe("proficiencyBonusMismatch");
    expect(issue?.params).toEqual({ override: 6, derived: 2, level: 1 });
  });

  it("warns when total level exceeds 20", () => {
    const result = loadCharacter({
      meta: { name: "Tav" },
      classes: [{ name: "Wizard", level: 20 }, { name: "Fighter", level: 5 }],
    });
    const issue = result.issues.find((i) => i.code === "levelExceeds20");
    expect(issue?.severity).toBe("warning");
    expect(issue?.params).toEqual({ level: 25 });
  });

  it("warns when current HP exceeds max + temporary", () => {
    const result = loadCharacter({
      meta: { name: "Tav" },
      combat: { hp: { max: 10, current: 15, temp: 0 } },
    });
    expect(result.issues.some((i) => i.code === "hpExceedsMax" && i.path === "combat.hp")).toBe(true);
  });

  it("warns when a spell has a material component but no materials listed", () => {
    const result = loadCharacter({
      meta: { name: "Tav" },
      spellSections: [{ entries: [{ name: "Fireball", components: { material: true } }] }],
    });
    const issue = result.issues.find((i) => i.code === "spellMaterialMissing");
    expect(issue?.severity).toBe("warning");
    expect(issue?.path).toBe("spellSections.0.entries.0");
    expect(issue?.params).toEqual({ label: "Fireball" });
  });

  it("does not warn once the material component is described", () => {
    const result = loadCharacter({
      meta: { name: "Tav" },
      spellSections: [
        { entries: [{ name: "Fireball", components: { material: true }, materials: [{ text: "bat guano" }] }] },
      ],
    });
    expect(result.issues.some((i) => i.code === "spellMaterialMissing")).toBe(false);
  });

  it("warns when a ritual spell has no duration", () => {
    const result = loadCharacter({
      meta: { name: "Tav" },
      spellSections: [{ entries: [{ name: "Detect Magic", ritual: true }] }],
    });
    const issue = result.issues.find((i) => i.code === "spellRitualNoDuration");
    expect(issue?.severity).toBe("warning");
    expect(issue?.params).toEqual({ label: "Detect Magic" });
  });
});
