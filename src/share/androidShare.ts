import { invoke } from "@tauri-apps/api/core";
import type { Character } from "../schema";
import { SCHEMA_CHANGELOG } from "../schema/changelog";
import { characterJsonSchema } from "../schema/jsonSchema";
import { isAndroid } from "../storage/androidProvider";

export type SharePromptKind = "base" | "create" | "level-up" | "validate" | "custom" | "migrate";

export interface AndroidShareFile {
  name: "prompt.txt";
  mime: "text/plain";
  contents: string;
}

export interface AndroidSharePayload {
  title: string;
  text: string;
  files: AndroidShareFile[];
}

const asJson = (value: unknown) => JSON.stringify(value, null, 2);

function bundleSection(title: string, contents: string): string {
  return `===== ${title} =====\n${contents}`;
}

/** Build one text/plain bundle: ACTION_SEND is the common denominator declared by chatbot apps.
 * The prompt also remains in EXTRA_TEXT; the file copy protects it from receivers that ignore
 * EXTRA_TEXT whenever an EXTRA_STREAM is present. `create` never includes the open character. */
export function buildPromptSharePayload(
  kind: SharePromptKind,
  title: string,
  text: string,
  character: Character | null,
): AndroidSharePayload | null {
  const needsCharacter = kind === "level-up" || kind === "validate" || kind === "migrate";
  if (needsCharacter && !character) return null;

  const sections = [
    bundleSection("PROMPT", text),
    bundleSection("character.schema.json", asJson(characterJsonSchema)),
  ];
  if (kind !== "create" && character) sections.push(bundleSection("character.json", asJson(character)));
  if (kind === "migrate") sections.push(bundleSection("schema-changelog.md", SCHEMA_CHANGELOG));

  return {
    title,
    text,
    files: [{ name: "prompt.txt", mime: "text/plain", contents: sections.join("\n\n") }],
  };
}

/** Opens Android's generic chooser. No chatbot package or provider SDK is selected by JUGALE. */
export async function sharePromptAndroid(payload: AndroidSharePayload): Promise<void> {
  if (!isAndroid()) throw new Error("Android sharing is unavailable on this platform");
  await invoke("plugin:android-share|share_prompt", { payload });
}
