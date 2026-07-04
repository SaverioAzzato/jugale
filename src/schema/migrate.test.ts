import { describe, it, expect } from "vitest";
import { migrateToCurrent, needsMigration, schemaMajor } from "./migrate";
import { CharacterSchema, SCHEMA_VERSION } from "./character";
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
    // Any file behind the current contract still needs a minor migration (2.0.0, 2.1.0, …).
    expect(needsMigration({ schemaVersion: "2.0.0" })).toBe(true);
    expect(needsMigration({ schemaVersion: "2.1.0" })).toBe(true);
    expect(needsMigration({ schemaVersion: SCHEMA_VERSION })).toBe(false);
  });
});

describe("v1 → v2 migration", () => {
  const migrated = migrateToCurrent(v1Character);
  const parsed = CharacterSchema.parse(migrated);

  it("produces a schema-valid v2 character", () => {
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.meta.name).toBe("Old PG");
    // `portrait` is no longer a schema field (the app derives the portrait from the
    // images/ folder), but unknown meta keys survive migration losslessly via passthrough.
    expect((parsed.meta as Record<string, { src: string }>).portrait.src).toBe("images/a.png");
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
    // v1's flat AC (13) has no override and no `ac` item, so 2.1→2.2 preserves it as an override.
    expect(parsed.combat.armorClassOverride).toBe(13);
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

  it("routes v1 languages to proficiencies and keeps race notes as traits", () => {
    expect(parsed.proficiencies.languages).toEqual(["Comune", "Draconico"]);
    expect((parsed.origin as Record<string, unknown>).languages).toBeUndefined();
    expect(parsed.origin.raceTraits).toContainEqual(
      expect.objectContaining({ description: "Scurovisione 18 m" }),
    );
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

describe("2.0.0 → 2.1.0 spell migration", () => {
  const v2_0 = {
    schemaVersion: "2.0.0",
    meta: { name: "Caster" },
    spellSections: [
      {
        id: "lvl1",
        title: "1st level",
        entries: [
          { name: "Shield", castingTime: "1 reaction, when hit by an attack", components: "V, S" },
          { name: "Find Familiar", castingTime: "10 minutes", components: "V, S, M (charcoal, incense worth 10 gp, which the spell consumes)" },
          {
            name: "Fireball",
            castingTime: "1 action",
            components: "V, S, M (a tiny ball of bat guano and sulfur)",
            description: "A bright streak flashes to a point.",
            notes: "It ignites flammable objects.",
          },
        ],
      },
    ],
  };

  const parsed = CharacterSchema.parse(migrateToCurrent(v2_0));
  const [shield, familiar, fireball] = parsed.spellSections[0].entries;

  it("bumps the version and flags migration for a 2.0.0 file", () => {
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(needsMigration(v2_0)).toBe(true);
    expect(loadCharacter(v2_0).migrated).toBe(true);
  });

  it("structures casting time, keeping a reaction trigger and a longer time value", () => {
    expect(shield.castingTime).toMatchObject({ type: "reaction", condition: "when hit by an attack" });
    expect(familiar.castingTime).toMatchObject({ type: "time", value: "10 minutes" });
    expect(fireball.castingTime).toMatchObject({ type: "action" });
  });

  it("splits V/S/M flags out of the component string", () => {
    expect(shield.components).toEqual({ verbal: true, somatic: true, material: false });
    expect(fireball.components).toEqual({ verbal: true, somatic: true, material: true });
  });

  it("lifts the parenthetical material into materials[], parsing cost and consumable", () => {
    expect(familiar.materials).toEqual([
      { text: "charcoal, incense worth 10 gp, which the spell consumes", cost: 10, consumable: true },
    ]);
    expect(fireball.materials).toEqual([{ text: "a tiny ball of bat guano and sulfur", cost: null, consumable: false }]);
    expect(shield.materials).toEqual([]);
  });

  it("folds the old separate notes field into description", () => {
    expect(fireball.description).toBe("A bright streak flashes to a point.\n\nIt ignites flammable objects.");
    expect((fireball as Record<string, unknown>).notes).toBeUndefined();
  });

  it("tolerates a stray legacy string on an already-2.1.0 file (schema coercion)", () => {
    const loose = CharacterSchema.parse({
      meta: { name: "X" },
      spellSections: [{ entries: [{ name: "Bless", castingTime: "1 action", components: "V, S, M" }] }],
    });
    expect(loose.spellSections[0].entries[0].components).toEqual({ verbal: true, somatic: true, material: true });
    expect(loose.spellSections[0].entries[0].castingTime.type).toBe("action");
  });
});

describe("2.1.0 → 2.2.0 armorClass removal", () => {
  const base = (combat: Record<string, unknown>, items: unknown[] = []) => ({
    schemaVersion: "2.1.0",
    meta: { name: "AC" },
    combat: { speed: { walk: 30 }, hp: { max: 1, current: 1 }, ...combat },
    inventory: { items },
  });

  it("drops a flat armorClass and never re-adds it", () => {
    const out = migrateToCurrent(base({ armorClass: 15 }));
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect("armorClass" in out.combat).toBe(false);
  });

  it("preserves a flat armorClass (no override, no ac item) as an override", () => {
    const out = migrateToCurrent(base({ armorClass: 15 }));
    expect(out.combat.armorClassOverride).toBe(15);
  });

  it("does not create an override for the bare default of 10", () => {
    const out = migrateToCurrent(base({ armorClass: 10 }));
    expect(out.combat.armorClassOverride ?? null).toBeNull();
  });

  it("just drops armorClass when an override is already set", () => {
    const out = migrateToCurrent(base({ armorClass: 15, armorClassOverride: 18 }));
    expect(out.combat.armorClassOverride).toBe(18);
    expect("armorClass" in out.combat).toBe(false);
  });

  it("just drops armorClass when an equipped ac item drives the AC", () => {
    const out = migrateToCurrent(
      base({ armorClass: 12 }, [{ name: "Leather", equipped: true, ac: { base: 11, addDex: true } }]),
    );
    expect(out.combat.armorClassOverride ?? null).toBeNull();
    expect("armorClass" in out.combat).toBe(false);
  });
});
