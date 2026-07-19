import { describe, expect, it } from "vitest";
import { composePrompt, composeHeader, defaultSegments, DEFAULT_GUIDES, DEFAULT_SEGMENTS, PROMPTS } from "./prompts";

describe("composePrompt", () => {
  it("base includes the disclaimer, interaction style, the sources, and the data contract", () => {
    const text = composePrompt("base", { guides: [{ name: "SRD" }] });
    expect(text).toContain("Content & licensing");
    expect(text).toContain("Interaction style");
    expect(text).toContain("one decision at a time");
    expect(text).toContain("Sources in scope");
    expect(text).toContain("- SRD");
    expect(text).toContain("How to edit character.json");
    expect(text).toContain("Retrieve rules; don't lean on memory"); // grounding over recall
    // base carries no task-specific section
    expect(text).not.toContain("Task: create");
  });

  it("task prompts are base + that task (disclaimer travels)", () => {
    const create = composePrompt("create", { guides: [{ name: "SRD" }] });
    expect(create).toContain("Content & licensing");
    expect(create).toContain("Task: create a character");
    expect(create).toContain("step by step");
  });

  it("migrate is a standalone, mechanical prompt (no base) referencing its attachments", () => {
    expect(PROMPTS.map((p) => p.id)).toContain("migrate");
    const migrate = composePrompt("migrate", { guides: [{ name: "SRD" }] });
    expect(migrate).not.toContain("Content & licensing"); // base does NOT travel
    expect(migrate).not.toContain("Sources in scope");
    expect(migrate).toContain("Migrate a character.json to the current schema");
    expect(migrate).toContain("schema-changelog.md");
    expect(migrate).toContain("character.schema.json");
    expect(migrate).toContain("in order"); // apply steps in sequence
  });

  it("base teaches modelling an extra-ability AC bonus as a bonus-only item, not an override", () => {
    const base = composePrompt("base", { guides: [{ name: "SRD" }] });
    expect(base).toContain("Unarmored Defense");
    expect(base).toContain("bonus-only");
    expect(base).toContain("stays live");
  });

  it("falls back to SRD-only when no guides are given", () => {
    const text = composePrompt("base", { guides: [] });
    expect(text).toContain(`- ${DEFAULT_GUIDES[0].name}`);
  });

  it("renders a guide's optional URL", () => {
    const text = composePrompt("base", { guides: [{ name: "MyWiki", url: "https://wiki.example" }] });
    expect(text).toContain("- MyWiki — https://wiki.example");
  });

  it("recomposes from customized segments, keeping the generated header", () => {
    const custom = {
      ...DEFAULT_SEGMENTS,
      baseIntro: "MY CUSTOM INTRO",
      tasks: { ...DEFAULT_SEGMENTS.tasks, create: "MY CUSTOM CREATE TASK" },
    };
    const base = composePrompt("base", { guides: [{ name: "SRD" }] }, custom);
    expect(base).toContain("MY CUSTOM INTRO");
    expect(base).toContain("Sources in scope"); // header still generated
    expect(base).not.toContain("Content & licensing"); // default intro replaced

    const create = composePrompt("create", { guides: [{ name: "SRD" }] }, custom);
    expect(create).toContain("MY CUSTOM INTRO");
    expect(create).toContain("MY CUSTOM CREATE TASK");
    expect(create).not.toContain("guided, step by step"); // default task replaced
  });

  it("adds a Focus section only when class/race are provided", () => {
    const none = composePrompt("base", { guides: [{ name: "SRD" }] });
    expect(none).not.toContain("## Focus");
    const focused = composePrompt("base", { guides: [{ name: "SRD" }], className: "Warlock", race: "Tiefling" });
    expect(focused).toContain("## Focus");
    expect(focused).toContain("**Warlock**");
    expect(focused).toContain("**Tiefling**");
  });
});

describe("prompt localization (EN / IT)", () => {
  it("ships distinct English and Italian default segments", () => {
    expect(defaultSegments("it").baseIntro).not.toBe(defaultSegments("en").baseIntro);
    expect(defaultSegments("it").baseContract).toContain("Come modificare character.json");
    expect(defaultSegments("en").baseContract).toContain("How to edit character.json");
  });

  it("composes an Italian prompt from Italian segments + a localized header", () => {
    const it = composePrompt("base", { guides: [{ name: "SRD" }] }, defaultSegments("it"), "it");
    expect(it).toContain("Contenuti e licenze"); // disclaimer
    expect(it).toContain("Fonti ammesse"); // generated header, localized
    expect(it).toContain("Come modificare character.json"); // data contract
    expect(it).not.toContain("Sources in scope");
  });

  it("keeps JSON keys in English even in the Italian prompt", () => {
    const it = defaultSegments("it").baseContract;
    expect(it).toContain("`combat.hp.current`");
    expect(it).toContain("spellSections[]");
    expect(it).toContain("`armorClassOverride`");
  });

  it("localizes the generated header's Focus labels", () => {
    const it = composeHeader({ guides: [{ name: "SRD" }], className: "Warlock", race: "Tiefling" }, "it");
    expect(it).toContain("Fonti ammesse");
    expect(it).toContain("la classe **Warlock**");
    expect(it).toContain("la razza/specie **Tiefling**");
  });

  it("the Italian migrate task is standalone and references its attachments", () => {
    const it = composePrompt("migrate", { guides: [] }, defaultSegments("it"), "it");
    expect(it).toContain("Migra un character.json allo schema corrente");
    expect(it).toContain("schema-changelog.md");
    expect(it).not.toContain("Fonti ammesse"); // base doesn't travel
  });
});

describe("custom instruction + base-prompt guidance", () => {
  const params = { guides: [{ name: "SRD" }] };

  it("appends the custom instruction (with a localized heading) to base and task prompts", () => {
    const base = composePrompt("base", params, DEFAULT_SEGMENTS, "en", "Always offer a backup.");
    expect(base).toContain("## Custom instruction");
    expect(base).toContain("Always offer a backup.");
    const create = composePrompt("create", params, DEFAULT_SEGMENTS, "en", "Always offer a backup.");
    expect(create).toContain("Always offer a backup."); // travels via base
    const it = composePrompt("base", params, defaultSegments("it"), "it", "Sempre un piano B.");
    expect(it).toContain("## Istruzione personalizzata");
  });

  it("adds nothing for an empty/whitespace custom instruction, and skips standalone migrate", () => {
    expect(composePrompt("base", params, DEFAULT_SEGMENTS, "en", "   ")).not.toContain("Custom instruction");
    expect(composePrompt("migrate", params, DEFAULT_SEGMENTS, "en", "ignored here")).not.toContain("ignored here");
  });

  it("teaches the export filename, proactive placement, and spaced-minus formula rule", () => {
    for (const seg of [DEFAULT_SEGMENTS, defaultSegments("it")]) {
      const text = seg.baseIntro + seg.baseContract;
      expect(text).toContain("character.json");
      expect(/proactive|propositiv/i.test(text)).toBe(true);
      expect(text).toContain("resources.sorcery-points.current"); // hyphen-in-id example
    }
  });
});
