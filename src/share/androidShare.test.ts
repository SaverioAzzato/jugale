import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCharacter } from "../schema";

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
  it("bundles the prompt, schema and open character into one text/plain share", () => {
    const payload = buildPromptSharePayload("level-up", "Level up", "prompt", character);
    expect(payload?.files).toHaveLength(1);
    expect(payload?.files[0]).toMatchObject({ name: "prompt.txt", mime: "text/plain" });
    expect(payload?.files[0].contents).toContain("===== PROMPT =====\nprompt");
    expect(payload?.files[0].contents).toContain("===== character.schema.json =====");
    expect(payload?.files[0].contents).toContain('"name": "Astrid"');
  });

  it("never attaches an open character to the create prompt", () => {
    const contents = buildPromptSharePayload("create", "Create", "prompt", character)?.files[0].contents;
    expect(contents).toContain("character.schema.json");
    expect(contents).not.toContain("===== character.json =====");
  });

  it("requires a character for update prompts and adds the changelog to migrate", () => {
    expect(buildPromptSharePayload("validate", "Validate", "prompt", null)).toBeNull();
    expect(buildPromptSharePayload("migrate", "Migrate", "prompt", character)?.files[0].contents).toContain(
      "===== schema-changelog.md =====",
    );
  });
});

describe("sharePromptAndroid", () => {
  const payload = { title: "Share", text: "prompt", files: [] };

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
