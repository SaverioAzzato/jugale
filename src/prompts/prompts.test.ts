import { describe, expect, it } from "vitest";
import { composePrompt, DEFAULT_GUIDES, DEFAULT_SEGMENTS } from "./prompts";

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
