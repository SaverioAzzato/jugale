import { describe, expect, it } from "vitest";
import type { Character } from "./character";
import { loadCharacter, type Issue } from "./validate";

interface LosslessLoadResult {
  source: unknown;
  draft: unknown;
  projection: Character;
  validation:
    | { kind: "valid"; persistable: unknown; issues: Issue[] }
    | { kind: "schema-invalid"; issues: Issue[] }
    | { kind: "future-schema"; schemaVersion: string; issues: Issue[] };
}

const asLossless = (result: ReturnType<typeof loadCharacter>) =>
  result as ReturnType<typeof loadCharacter> & Partial<LosslessLoadResult>;

const healthySections = {
  meta: {
    name: "Lossless",
    nestedUnknown: { campaignId: "moon-7", flags: ["keep", "all"] },
  },
  inventory: {
    items: [{ id: "rope", name: "Rope", quantity: 2, itemUnknown: { color: "red" } }],
    inventoryUnknown: { owner: "party" },
  },
  homebrew: { luck: 3, nested: { untouched: true } },
};

describe("loadCharacter — lossless invalid documents", () => {
  it.each([
    ["top-level", { ...healthySections, schemaVersion: "2.2.0", classes: "not-an-array" }],
    [
      "nested field",
      {
        ...healthySections,
        schemaVersion: "2.2.0",
        combat: { hp: { max: 12, current: "hurt", temp: 0, hpUnknown: "keep" }, combatUnknown: 9 },
      },
    ],
    [
      "array entry",
      {
        ...healthySections,
        schemaVersion: "2.2.0",
        resources: [{ id: "ki", label: "Ki", max: 3, current: "two", resourceUnknown: [1, 2] }],
      },
    ],
  ])("keeps the complete source and draft when one %s is invalid", (_label, raw) => {
    const result = asLossless(loadCharacter(raw));

    expect(result.ok).toBe(false);
    expect(result.source).toEqual(raw);
    expect(result.draft).toEqual(raw);
    expect(result.validation?.kind).toBe("schema-invalid");
    expect(result.projection).toBeTruthy();
    expect(result.projection?.inventory.items[0]?.name).toBe("Rope");
  });

  it("keeps pre-migration source separate from the valid migrated draft", () => {
    const raw = {
      schemaVersion: "2.1.0",
      meta: { name: "Older", unknownMeta: { keep: true } },
      combat: { armorClass: 15 },
      homebrew: { topLevel: "keep" },
    };
    const result = asLossless(loadCharacter(raw));

    expect(result.source).toEqual(raw);
    expect(result.draft).toMatchObject({
      schemaVersion: "2.2.0",
      meta: { unknownMeta: { keep: true } },
      combat: { armorClassOverride: 15 },
      homebrew: { topLevel: "keep" },
    });
    expect(result.draft).not.toHaveProperty("combat.armorClass");
    expect(result.validation?.kind).toBe("valid");
    if (result.validation?.kind === "valid") {
      expect(result.validation.persistable.document).toBe(result.draft);
    }
  });

  it("keeps future-schema files untouched and non-persistable", () => {
    const raw = {
      ...healthySections,
      schemaVersion: "9.4.0",
      futureSection: { mechanics: [{ id: "new-rule", value: 42 }] },
    };
    const result = asLossless(loadCharacter(raw));

    expect(result.source).toEqual(raw);
    expect(result.draft).toEqual(raw);
    expect(result.validation).toMatchObject({ kind: "future-schema", schemaVersion: "9.4.0" });
    expect(result.validation).not.toHaveProperty("persistable");
  });
});
