import { describe, expect, it } from "vitest";
import { loadCharacter } from "../schema";
import { SCHEMA_CHANGELOG } from "../schema/changelog";
import { buildPromptBundle, promptBundleFilename } from "./bundle";

const character = loadCharacter({ meta: { name: "Astrid" } }).character;

describe("prompt text bundles", () => {
  it("always contains the prompt and current JSON Schema", () => {
    const bundle = buildPromptBundle("level-up", "level prompt", null);

    expect(bundle.text).toContain("===== PROMPT =====\nlevel prompt");
    expect(bundle.text).toContain("===== character.schema.json =====");
    expect(bundle.text).not.toContain("===== character.json =====");
    expect(bundle.attachments).toHaveProperty("character.schema.json");
  });

  it("includes the complete open character for every downloaded prompt kind", () => {
    const bundle = buildPromptBundle("create", "create prompt", character);

    expect(bundle.text).toContain("===== character.json =====");
    expect(bundle.text).toContain('"name": "Astrid"');
    expect(bundle.attachments["character.json"]).toBe(character);
  });

  it("adds the schema changelog only to migration bundles", () => {
    expect(buildPromptBundle("validate", "validate", character).attachments).not.toHaveProperty(
      "schema-changelog.md",
    );
    const migrate = buildPromptBundle("migrate", "migrate", character);
    expect(migrate.attachments["schema-changelog.md"]).toBe(SCHEMA_CHANGELOG);
    expect(migrate.text).toContain("===== schema-changelog.md =====");
  });

  it("uses a stable descriptive text filename", () => {
    expect(promptBundleFilename("level-up")).toBe("jugale-level-up-prompt.txt");
  });
});
