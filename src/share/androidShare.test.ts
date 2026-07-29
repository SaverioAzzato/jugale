import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCharacter } from "../schema";
import { SCHEMA_CHANGELOG } from "../schema/changelog";

const { invoke, android } = vi.hoisted(() => ({ invoke: vi.fn(), android: { value: true } }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../storage/androidProvider", () => ({ isAndroid: () => android.value }));

import { buildPromptSharePayload, sharePromptAndroid } from "./androidShare";

const character = loadCharacter({ meta: { name: "Astrid" } }).character;

beforeEach(() => {
  invoke.mockReset();
  android.value = true;
});

describe("buildPromptSharePayload", () => {
  it("builds a JSON primary and text fallback with the same prompt context", () => {
    const payload = buildPromptSharePayload("level-up", "Level up", "prompt", character);
    expect(payload?.variants).toHaveLength(2);
    expect(payload?.variants[0].file).toMatchObject({
      name: "jugale-request.json",
      mime: "application/json",
    });
    const request = JSON.parse(payload?.variants[0].file.contents ?? "{}");
    expect(request).toMatchObject({
      jugaleRequestVersion: 1,
      instructions: "prompt",
      attachments: { "character.json": { meta: { name: "Astrid" } } },
    });
    expect(request.attachments["character.schema.json"]).toBeTypeOf("object");
    expect(payload?.variants[0].text).toBe("prompt");
    expect(payload?.variants[1].file).toMatchObject({ name: "prompt.txt", mime: "text/plain" });
    expect(payload?.variants[1].file.contents).toContain("===== PROMPT =====\nprompt");
    expect(payload?.variants[1].file.contents).toContain("===== character.schema.json =====");
    expect(payload?.variants[1].file.contents).toContain('"name": "Astrid"');
    expect(payload?.variants[1].text).toBe(payload?.variants[1].file.contents);
  });

  it("never attaches an open character to the create prompt", () => {
    const payload = buildPromptSharePayload("create", "Create", "prompt", character);
    const request = JSON.parse(payload?.variants[0].file.contents ?? "{}");
    expect(request.attachments["character.schema.json"]).toBeTypeOf("object");
    expect(request.attachments).not.toHaveProperty("character.json");
    expect(payload?.variants[1].file.contents).not.toContain("===== character.json =====");
  });

  it("requires a character for update prompts and adds the changelog to migrate", () => {
    expect(buildPromptSharePayload("validate", "Validate", "prompt", null)).toBeNull();
    const payload = buildPromptSharePayload("migrate", "Migrate", "prompt", character);
    const request = JSON.parse(payload?.variants[0].file.contents ?? "{}");
    expect(request.attachments["schema-changelog.md"]).toBe(SCHEMA_CHANGELOG);
    expect(payload?.variants[1].file.contents).toContain("===== schema-changelog.md =====");
  });
});

describe("sharePromptAndroid", () => {
  const payload = { title: "Share", variants: [] };

  it("invokes only the scoped native command", async () => {
    await sharePromptAndroid(payload);
    expect(invoke).toHaveBeenCalledWith("plugin:android-share|share_prompt", { payload });
  });

  it("rejects outside Android", async () => {
    android.value = false;
    await expect(sharePromptAndroid(payload)).rejects.toThrow("unavailable");
    expect(invoke).not.toHaveBeenCalled();
  });
});
