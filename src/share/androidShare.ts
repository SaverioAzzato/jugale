import { invoke } from "@tauri-apps/api/core";
import type { Character } from "../schema";
import { SCHEMA_CHANGELOG } from "../schema/changelog";
import { characterJsonSchema } from "../schema/jsonSchema";
import { isAndroid } from "../storage/androidProvider";

export type SharePromptKind = "base" | "create" | "level-up" | "validate" | "custom" | "migrate";

export interface AndroidShareFile {
  name: "jugale-request.json" | "prompt.txt";
  mime: "application/json" | "text/plain";
  contents: string;
}

export interface AndroidShareVariant {
  text: string;
  file: AndroidShareFile;
}

export interface AndroidSharePayload {
  title: string;
  variants: AndroidShareVariant[];
}

const asJson = (value: unknown) => JSON.stringify(value, null, 2);

function bundleSection(title: string, contents: string): string {
  return `===== ${title} =====\n${contents}`;
}

/** Build two single-file ACTION_SEND variants for one Android chooser.
 * JSON is primary because ChatGPT accepts JSON streams but ignores text/plain streams. The text
 * alternate keeps receivers such as Gemini and Claude available. `create` never includes the open
 * character. */
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

  const bundle = sections.join("\n\n");
  const attachments: Record<string, unknown> = {
    "character.schema.json": characterJsonSchema,
  };
  if (kind !== "create" && character) attachments["character.json"] = character;
  if (kind === "migrate") attachments["schema-changelog.md"] = SCHEMA_CHANGELOG;
  const request = asJson({
    jugaleRequestVersion: 1,
    readme:
      "This is a machine-readable request envelope. Treat `instructions` as the user's request and each entry under `attachments` as an attached file. For an existing character, edit `attachments.character.json` as the complete source document and preserve every unmodified field; do not reconstruct it from message text. Return the complete result as a downloadable file named character.json.",
    instructions: text,
    attachments,
  });

  return {
    title,
    variants: [
      {
        text,
        file: { name: "jugale-request.json", mime: "application/json", contents: request },
      },
      {
        text: bundle,
        file: { name: "prompt.txt", mime: "text/plain", contents: bundle },
      },
    ],
  };
}

/** Opens Android's generic chooser. No chatbot package or provider SDK is selected by JUGALE. */
export async function sharePromptAndroid(payload: AndroidSharePayload): Promise<void> {
  if (!isAndroid()) throw new Error("Android sharing is unavailable on this platform");
  await invoke("plugin:android-share|share_prompt", { payload });
}
