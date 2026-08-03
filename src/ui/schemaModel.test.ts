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
import { characterJsonSchema } from "../schema/jsonSchema";

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

type JsonSchema = Record<string, unknown>;

const schemaRoot = characterJsonSchema as JsonSchema;

function resolvePointer(pointer: string): JsonSchema {
  return pointer.slice(2).split("/").reduce<unknown>((value, segment) => {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    return (value as JsonSchema)[key];
  }, schemaRoot) as JsonSchema;
}

function resolveSchema(schema: JsonSchema): JsonSchema {
  if (typeof schema.$ref !== "string") return schema;
  const { $ref: _ref, ...siblings } = schema;
  return { ...resolveSchema(resolvePointer(schema.$ref)), ...siblings };
}

function schemaType(schema: JsonSchema): string | undefined {
  const type = schema.type;
  return typeof type === "string" ? type : undefined;
}

function nullableBranch(schema: JsonSchema): JsonSchema | null {
  const resolved = resolveSchema(schema);
  if (Array.isArray(resolved.type) && resolved.type.includes("null")) {
    const type = resolved.type.find((entry) => entry !== "null");
    const { default: _default, ...withoutDefault } = resolved;
    return { ...withoutDefault, type };
  }
  if (!Array.isArray(resolved.anyOf)) return null;
  const branches = (resolved.anyOf as JsonSchema[]).map(resolveSchema);
  const nonNull = branches.filter((branch) => schemaType(branch) !== "null");
  if (branches.length !== 2 || nonNull.length !== 1) return null;
  const { default: _default, ...inner } = nonNull[0];
  return inner;
}

/** Merge the discriminated custom-section object union into the editor's enum-shaped view. */
function mergedObjectUnion(schema: JsonSchema): JsonSchema | null {
  const resolved = resolveSchema(schema);
  if (!Array.isArray(resolved.anyOf)) return null;
  const branches = (resolved.anyOf as JsonSchema[]).map(resolveSchema);
  if (!branches.length || branches.some((branch) => schemaType(branch) !== "object")) return null;
  const properties: Record<string, JsonSchema> = {};
  for (const branch of branches) {
    for (const [key, value] of Object.entries((branch.properties ?? {}) as Record<string, JsonSchema>)) {
      const property = resolveSchema(value);
      const existing = properties[key];
      if (key === "layout" && typeof property.const === "string") {
        const values = new Set<string>([...((existing?.enum as string[] | undefined) ?? []), property.const]);
        properties[key] = { ...property, const: undefined, enum: [...values], default: existing?.default ?? property.default };
      } else if (!existing) {
        properties[key] = property;
      }
    }
  }
  return { type: "object", properties };
}

function expectParity(model: SchemaNode, input: JsonSchema, path = "$"): void {
  const schema = resolveSchema(input);
  if (model.type === "nullable") {
    const inner = nullableBranch(schema);
    expect(inner, `${path} should be nullable`).not.toBeNull();
    if ("default" in schema) expect(schema.default, `${path} nullable default`).toBeNull();
    expectParity(model.inner, inner!, path);
    return;
  }
  if (model.type === "union") {
    const branches = (schema.anyOf as JsonSchema[] | undefined)?.map(resolveSchema) ?? [];
    expect(branches, `${path} union branch count`).toHaveLength(model.options.length);
    model.options.forEach((option) => {
      const branch = branches.find((candidate) => schemaType(candidate) === option.type);
      expect(branch, `${path} missing ${option.type} union branch`).toBeDefined();
      expectParity(option, branch!, path);
    });
    return;
  }
  if (model.type === "object") {
    const objectSchema = schemaType(schema) === "object" ? schema : mergedObjectUnion(schema);
    expect(objectSchema, `${path} should be an object`).not.toBeNull();
    let properties = (objectSchema!.properties ?? {}) as Record<string, JsonSchema>;
    if (
      Object.keys(properties).length === 0 &&
      objectSchema!.default &&
      typeof objectSchema!.default === "object" &&
      !Array.isArray(objectSchema!.default) &&
      objectSchema!.additionalProperties &&
      typeof objectSchema!.additionalProperties === "object"
    ) {
      properties = Object.fromEntries(
        Object.entries(objectSchema!.default as Record<string, unknown>)
          .map(([key, value]) => [key, { ...(objectSchema!.additionalProperties as JsonSchema), default: value }]),
      );
    }
    expect(Object.keys(properties), `${path} object keys`).toEqual(Object.keys(model.fields));
    for (const [key, child] of Object.entries(model.fields)) expectParity(child, properties[key], `${path}.${key}`);
    return;
  }
  if (model.type === "array") {
    expect(schemaType(schema), `${path} type`).toBe("array");
    const item = (schema.items ?? {}) as JsonSchema;
    if (Object.keys(item).length > 0) expectParity(model.item, item, `${path}[]`);
    else expect(model.item.type, `${path} unknown item sentinel`).toBe("null");
    return;
  }
  if (model.type === "null") {
    expect(schemaType(schema), `${path} type`).toBe("null");
    return;
  }
  const actualType = schemaType(schema);
  expect(actualType === "integer" ? "number" : actualType, `${path} type`).toBe(model.type);
  if (model.type === "string" && model.enum) {
    expect(schema.enum, `${path} enum`).toEqual(model.enum);
  }
  if ("default" in model && "default" in schema) {
    expect(schema.default, `${path} default`).toEqual(model.default);
  }
}

describe("schemaModel — exported contract parity", () => {
  it("matches every JSON Schema key, enum, and completion-bearing primitive default", () => {
    expectParity(CHARACTER_MODEL, schemaRoot);
  });
});
