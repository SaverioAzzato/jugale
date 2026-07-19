import { describe, it, expect } from "vitest";
import {
  CHARACTER_MODEL,
  scaffoldSnippet,
  containerSkeletonSnippet,
  keyEntrySnippet,
  elementEntrySnippet,
  valueOptionsAt,
  objectKeys,
  fieldNode,
  childForSegment,
  hasIdField,
  type SchemaNode,
} from "./schemaModel";
import { loadCharacter } from "../schema";

/** Turn a CodeMirror snippet template into plain JSON text: `${}`→"", `${custom}`→custom, `${10}`→10. */
const strip = (snippet: string): string => snippet.replace(/\$\{([^}]*)\}/g, "$1");
const parseSnippet = (snippet: string): unknown => JSON.parse(strip(snippet));

/** Walk the model by path (object keys / array indices). */
function nodeAt(path: (string | number)[]): SchemaNode {
  let node: SchemaNode | null = CHARACTER_MODEL;
  for (const seg of path) node = childForSegment(node!, seg);
  return node!;
}

describe("schemaModel — scaffold", () => {
  it("produces a document that parses and validates once a name is filled", () => {
    const scaffold = parseSnippet(scaffoldSnippet()) as Record<string, unknown>;
    (scaffold.meta as { name: string }).name = "Vex";
    const result = loadCharacter(scaffold);
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(result.character.meta.name).toBe("Vex");
  });

  it("keeps the current schemaVersion as a literal (no placeholder to edit)", () => {
    const scaffold = parseSnippet(scaffoldSnippet()) as { schemaVersion: string };
    expect(scaffold.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("scaffolds collection arrays empty (filled on demand, not up front)", () => {
    const scaffold = parseSnippet(scaffoldSnippet()) as Record<string, unknown>;
    expect(scaffold.classes).toEqual([]);
    expect(scaffold.resources).toEqual([]);
    expect(scaffold.spellSections).toEqual([]);
    // Objects, by contrast, come fully shaped.
    expect(scaffold.abilities).toMatchObject({ str: { score: 10 }, cha: { score: 10 } });
    expect(scaffold.combat).toHaveProperty("hp");
  });
});

describe("schemaModel — section skeletons", () => {
  it("fills an empty object section with its fields", () => {
    const combat = parseSnippet(containerSkeletonSnippet(fieldNode(CHARACTER_MODEL, "combat")!)) as Record<string, unknown>;
    expect(combat).toHaveProperty("hp");
    expect(combat).toHaveProperty("speed");
    expect(combat.attacks).toEqual([]);
  });

  it("fills an empty array section with one element, baking in a generated id", () => {
    const resourcesNode = fieldNode(CHARACTER_MODEL, "resources")!;
    const arr = parseSnippet(containerSkeletonSnippet(resourcesNode, { idValue: "res-1" })) as Array<Record<string, unknown>>;
    expect(arr).toHaveLength(1);
    expect(arr[0].id).toBe("res-1");
    expect(arr[0].category).toBe("custom");
  });

  it("omits escape-hatch keys (link, *Override) from skeletons", () => {
    const identity = strip(containerSkeletonSnippet(fieldNode(CHARACTER_MODEL, "identity")!));
    expect(identity).not.toContain("link");
    const combat = strip(containerSkeletonSnippet(fieldNode(CHARACTER_MODEL, "combat")!));
    expect(combat).not.toContain("armorClassOverride");
  });
});

describe("schemaModel — key + element entries", () => {
  it("expands a nullable-object key (ac) to its object shape, not null", () => {
    const itemNode = nodeAt(["inventory", "items", 0]);
    const entry = keyEntrySnippet(fieldNode(itemNode, "ac")!, "ac");
    const wrapped = parseSnippet(`{ ${entry} }`) as { ac: Record<string, unknown> };
    expect(wrapped.ac).toMatchObject({ base: null, addDex: false, bonus: 0 });
  });

  it("uses null for a nullable scalar key (level)", () => {
    const resourceNode = nodeAt(["resources", 0]);
    const entry = keyEntrySnippet(fieldNode(resourceNode, "level")!, "level");
    expect(strip(entry)).toBe('"level": null');
  });

  it("renders a standalone array element that validates in context", () => {
    const spellNode = nodeAt(["spellSections", 0, "entries", 0]);
    const spell = parseSnippet(elementEntrySnippet(spellNode, { idValue: "x" })) as Record<string, unknown>;
    expect(spell).toMatchObject({ prepared: true, concentration: false });
    expect(spell.castingTime).toMatchObject({ type: "action" });
  });
});

describe("schemaModel — value options", () => {
  it("offers enum members for an enum field", () => {
    const category = nodeAt(["resources", 0, "category"]);
    expect(valueOptionsAt(category).map((o) => o.label)).toEqual(["spellSlot", "points", "dice", "charges", "ammo", "custom"]);
  });

  it("offers enum members plus null for a nullable enum", () => {
    const ability = nodeAt(["classes", 0, "spellcasting", "ability"]);
    const labels = valueOptionsAt(ability).map((o) => o.label);
    expect(labels).toContain("cha");
    expect(labels).toContain("null");
  });

  it("offers true/false for a boolean", () => {
    const equipped = nodeAt(["inventory", "items", 0, "equipped"]);
    expect(valueOptionsAt(equipped).map((o) => o.insert)).toEqual(["true", "false"]);
  });

  it("offers null only for a nullable scalar (nothing enumerable)", () => {
    const level = nodeAt(["resources", 0, "level"]);
    expect(valueOptionsAt(level).map((o) => o.label)).toEqual(["null"]);
  });
});

describe("schemaModel — helpers", () => {
  it("lists object keys in schema order and finds id-bearing elements", () => {
    expect(objectKeys(fieldNode(CHARACTER_MODEL, "meta")!)).toEqual(["name", "player", "summary", "ruleset", "tags"]);
    expect(hasIdField(nodeAt(["resources", 0]))).toBe(true);
    expect(hasIdField(nodeAt(["abilities", "str"]))).toBe(false);
  });
});
