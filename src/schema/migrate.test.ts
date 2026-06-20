import { describe, it, expect } from "vitest";
import { migrateToCurrent, needsMigration, schemaMajor } from "./migrate";
import { CharacterSchema } from "./character";
import { loadCharacter } from "./validate";
import { spellSaveDc } from "./derive";

const v1Character = {
  schemaVersion: "1.0.0",
  meta: { name: "Old PG", player: "Saverio", summary: "vecchia scheda", portrait: { src: "images/01.svg" } },
  identity: [
    { label: "Classe", value: "Warlock" },
    { label: "Livello", value: "5" },
    { label: "Razza", value: "Tiefling" },
  ],
  build: {
    abilities: [
      { name: "Carisma", score: "17", modifier: "+3" },
      { name: "Destrezza", score: "14", modifier: "+2" },
    ],
    savingThrows: [{ name: "Tiro Salvezza Carisma", value: "+6" }],
    skills: [{ name: "Arcano", value: "+5" }],
    proficiencies: ["Armi semplici", "Armature leggere"],
  },
  combat: {
    attacks: [{ name: "Eldritch Blast", link: "http://x", level: "Trucchetto" }],
    spellcasting: { slots: "2 slot del patto di livello 3" },
  },
  spellSections: [
    { title: "Trucchetti", entries: [{ name: "EB", link: "http://x", level: "0", concentration: "No" }] },
    { title: "Livello 1", entries: [{ name: "Hex", level: "1", concentration: "Sì" }] },
  ],
  features: { items: [{ label: "Patto del Tomo", text: "libro", link: "http://y" }], levelChecklist: ["Scegli invocazione"] },
  inventory: { currencies: { gold: 120, silver: 5, copper: 1 }, items: [{ name: "Pozione", quantity: 3 }] },
  origin: { languages: ["Comune", "Infernale"], raceNotes: ["Resistenza al fuoco"], backgroundFeature: ["Ricercatore"] },
  narrative: { roleplay: ["Curioso"], appearance: ["Corna"], story: ["Patto"], unfilled: ["TODO"] },
  reminders: { notes: ["Ricorda Hex"], tablePlay: ["Tira 1d20"] },
  session: {
    resources: {
      currentHp: 30,
      maxHp: 38,
      tempHp: 0,
      slots: { pact: { total: 2, used: 1 }, lvl1: { total: 0, used: 0 } },
      arrows: 12,
    },
  },
};

describe("migration detection", () => {
  it("flags v1 as needing migration", () => {
    expect(schemaMajor(v1Character)).toBe(1);
    expect(needsMigration(v1Character)).toBe(true);
    expect(needsMigration({ schemaVersion: "2.0.0" })).toBe(false);
  });
});

describe("v1 → v2 migration", () => {
  const migrated = migrateToCurrent(v1Character);
  const parsed = CharacterSchema.parse(migrated);

  it("produces a schema-valid v2 character", () => {
    expect(parsed.schemaVersion).toBe("2.0.0");
    expect(parsed.meta.name).toBe("Old PG");
  });

  it("maps identity[] into classes[] and identity object", () => {
    expect(parsed.classes).toHaveLength(1);
    expect(parsed.classes[0]).toMatchObject({ name: "Warlock", level: 5 });
    expect(parsed.identity.race).toBe("Tiefling");
  });

  it("maps Italian ability names and save proficiency", () => {
    expect(parsed.abilities.cha.score).toBe(17);
    expect(parsed.abilities.cha.saveProficient).toBe(true);
    expect(parsed.abilities.dex.score).toBe(14);
    expect(spellSaveDc(parsed, "cha")).toBe(14); // sanity: derived from migrated data
  });

  it("converts slots dict + arrows into generic resources", () => {
    const pact = parsed.resources.find((r) => r.id === "pact");
    expect(pact).toMatchObject({ category: "spellSlot", max: 2, current: 1, resetOn: "shortRest" });
    const arrows = parsed.resources.find((r) => r.id === "arrows");
    expect(arrows).toMatchObject({ category: "ammo", current: 12 });
  });

  it("moves HP into combat.hp", () => {
    expect(parsed.combat.hp).toMatchObject({ max: 38, current: 30, temp: 0 });
  });

  it("converts concentration strings to booleans", () => {
    const hex = parsed.spellSections[1].entries[0];
    expect(hex.concentration).toBe(true);
  });

  it("remaps currencies gold/silver/copper → gp/sp/cp", () => {
    expect(parsed.inventory.currencies).toMatchObject({ gp: 120, sp: 5, cp: 1 });
  });

  it("preserves orphan v1 data as custom sections (lossless)", () => {
    const titles = parsed.customSections.map((s) => s.title);
    expect(titles).toContain("Competenze (migrato)");
    expect(titles).toContain("Abilità (migrato)");
    expect(titles).toContain("Note (migrato)");
  });
});

describe("loadCharacter on v1 input", () => {
  it("loads, flags migrated, and reports no errors", () => {
    const result = loadCharacter(v1Character);
    expect(result.ok).toBe(true);
    expect(result.migrated).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
});
