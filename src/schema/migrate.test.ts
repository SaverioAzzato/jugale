import { describe, it, expect } from "vitest";
import { migrateToCurrent, needsMigration, schemaMajor } from "./migrate";
import { CharacterSchema } from "./character";
import { loadCharacter } from "./validate";
import { spellSaveDc } from "./derive";

// A v1 fixture mirroring the tricky bits of a real hand-written sheet:
// numeric schemaVersion, freeform identity (combined class+level, race `parts`),
// abbreviated saving throws flagged "competente", baseStats, and unknown top-level keys.
const v1Character = {
  schemaVersion: 1,
  platform: { name: "old tool", mode: "dnd-5e" },
  meta: { name: "Old PG", player: "Saverio", summary: "vecchia scheda", portrait: { src: "images/a.png" } },
  identity: [
    { label: "Classe e livello", value: "Warlock 4", link: "http://warlock" },
    { label: "Patrono", value: "Immondo (Fiend)" },
    { label: "Razza", parts: [{ value: "Draconide", link: "http://drac" }, { value: "Tiefling" }] },
    { label: "Background", value: "Forestiero" },
    { label: "Allineamento", value: "Neutrale Buono" },
  ],
  build: {
    baseStats: [
      { label: "CA", value: "13", note: "cuoio 11 + Des 2" },
      { label: "Velocità", value: "9 m" },
    ],
    abilities: [
      { name: "Carisma", score: 18, modifier: "+4" },
      { name: "Costituzione", score: 15, modifier: "+2" },
    ],
    savingThrows: [
      { name: "Car", value: "+6", note: "competente" },
      { name: "Sag", value: "+2", note: "competente" },
      { name: "For", value: "+0" },
    ],
    skills: [
      { name: "Atletica", value: "+2", note: "competente" },
      { name: "Arcano", value: "+1" },
    ],
    proficiencies: ["Warlock: armature leggere, armi semplici."],
  },
  combat: {
    spellcasting: { slots: "2 slot di 2 livello" },
    attacks: [{ name: "Pugnale", link: "http://x", level: "Base" }],
    levelNotes: ["Livello 4: +2 Carisma."],
  },
  spellSections: [{ title: "Trucchetti", entries: [{ name: "EB", link: "http://x", level: "0", concentration: "No" }] }],
  features: { items: [{ label: "Patto del Tomo", text: "libro", link: "http://y" }], levelChecklist: ["Scegli trucchetto"] },
  inventory: { currencies: { gold: 838, silver: 5, copper: 5 }, items: [{ name: "Pozione", quantity: 3 }] },
  origin: { languages: ["Comune", "Draconico"], raceNotes: ["Scurovisione 18 m"], backgroundFeature: ["Viandante"] },
  narrative: { roleplay: ["Testardo"], appearance: ["Età 20"], story: ["Origini misteriose"], unfilled: ["Tesoro"] },
  reminders: { notes: ["Slot del Patto restano 2"], tablePlay: ["Tira 1d20"] },
  session: {
    resources: {
      currentHp: 31,
      maxHp: 31,
      tempHp: 0,
      slots: { pact: { total: 2, used: 1 }, focus: { total: 2, used: 0 }, inspiration: { total: 1, used: 0 } },
      arrows: 15,
    },
    inventoryNotes: "nota",
    lastSavedAt: "2026-06-13T22:48:10.433Z",
  },
};

describe("migration detection", () => {
  it("treats numeric schemaVersion 1 as v1", () => {
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
    expect(parsed.meta.portrait.src).toBe("images/a.png");
  });

  it("parses class + embedded level and race `parts`", () => {
    expect(parsed.classes[0]).toMatchObject({ name: "Warlock", level: 4, subclass: "Immondo (Fiend)" });
    expect(parsed.identity.race).toBe("Draconide / Tiefling");
    expect(parsed.identity.background).toBe("Forestiero");
  });

  it("maps abilities and detects save proficiency from the 'competente' note", () => {
    expect(parsed.abilities.cha.score).toBe(18);
    expect(parsed.abilities.cha.saveProficient).toBe(true);
    expect(parsed.abilities.wis.saveProficient).toBe(true);
    expect(parsed.abilities.str.saveProficient).toBe(false);
    expect(spellSaveDc(parsed, "cha")).toBe(14); // 8 + PB2 + CHA+4
  });

  it("maps competent skills to proficiencies.skills", () => {
    expect(parsed.proficiencies.skills).toContainEqual(expect.objectContaining({ id: "athletics", proficient: true }));
    expect(parsed.proficiencies.skills.find((s) => s.id === "arcana")).toBeUndefined();
  });

  it("reads AC and speed from baseStats", () => {
    expect(parsed.combat.armorClass).toBe(13);
    expect(parsed.combat.speed.walk).toBe(9);
    expect(parsed.combat.hp).toMatchObject({ max: 31, current: 31 });
  });

  it("converts slots and arrows into generic resources with sensible categories", () => {
    expect(parsed.resources.find((r) => r.id === "pact")).toMatchObject({ category: "spellSlot", max: 2, current: 1, resetOn: "shortRest" });
    expect(parsed.resources.find((r) => r.id === "focus")).toMatchObject({ category: "charges", resetOn: "longRest" });
    expect(parsed.resources.find((r) => r.id === "arrows")).toMatchObject({ category: "ammo", current: 15 });
  });

  it("remaps currencies and converts concentration strings", () => {
    expect(parsed.inventory.currencies).toMatchObject({ gp: 838, sp: 5, cp: 5 });
    expect(parsed.spellSections[0].entries[0].concentration).toBe(false);
  });

  it("is lossless: unknown top-level keys and orphan lists survive", () => {
    expect((parsed as Record<string, unknown>).platform).toEqual({ name: "old tool", mode: "dnd-5e" });
    const titles = parsed.customSections.map((s) => s.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Identità (migrato)",
        "Numeri base (migrato)",
        "Competenze (migrato)",
        "Note di livello (migrato)",
        "Note (migrato)",
      ]),
    );
    expect((parsed.session as Record<string, unknown>).lastSavedAt).toBe("2026-06-13T22:48:10.433Z");
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
