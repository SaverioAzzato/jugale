import { invoke } from "@tauri-apps/api/core";
import type { Character } from "../schema";
import { SCHEMA_CHANGELOG } from "../schema/changelog";
import { characterJsonSchema } from "../schema/jsonSchema";
import { isAndroid } from "../storage/androidProvider";

export type SharePromptKind = "base" | "create" | "level-up" | "validate" | "custom" | "migrate";

export interface AndroidShareFile {
  name: "character.schema.json" | "character.json" | "schema-changelog.md";
  mime: "application/json" | "text/markdown";
  contents: string;
}

export interface AndroidSharePayload {
  title: string;
  text: string;
  files: AndroidShareFile[];
}

const asJson = (value: unknown) => JSON.stringify(value, null, 2);

/** Build the documented first-spike payload. Keeping this pure makes the attachment contract
 * testable without an Android runtime. `create` deliberately never sends the open character. */
export function buildPromptSharePayload(
  kind: SharePromptKind,
  title: string,
  text: string,
  character: Character | null,
): AndroidSharePayload | null {
  const needsCharacter = kind === "level-up" || kind === "validate" || kind === "migrate";
  if (needsCharacter && !character) return null;

  const files: AndroidShareFile[] = [
    {
      name: "character.schema.json",
      mime: "application/json",
      contents: asJson(characterJsonSchema),
    },
  ];

  if (kind !== "create" && character) {
    files.push({ name: "character.json", mime: "application/json", contents: asJson(character) });
  }
  if (kind === "migrate") {
    files.push({ name: "schema-changelog.md", mime: "text/markdown", contents: SCHEMA_CHANGELOG });
  }

  return { title, text, files };
}

/** Opens Android's generic chooser. No chatbot package or provider SDK is selected by JUGALE. */
export async function sharePromptAndroid(payload: AndroidSharePayload): Promise<void> {
  if (!isAndroid()) throw new Error("Android sharing is unavailable on this platform");
  await invoke("plugin:android-share|share_prompt", { payload });
}
