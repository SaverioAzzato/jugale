import type { Character } from "../schema";
import { SCHEMA_CHANGELOG } from "../schema/changelog";
import { characterJsonSchema } from "../schema/jsonSchema";

export type PromptBundleKind = "base" | "create" | "level-up" | "validate" | "custom" | "migrate";

export interface PromptBundle {
  text: string;
  attachments: Record<string, unknown>;
}

const asJson = (value: unknown) => JSON.stringify(value, null, 2);

function section(title: string, contents: string): string {
  return `===== ${title} =====\n${contents}`;
}

/** Canonical single-text-file context for prompt downloads and Android's text share variant. */
export function buildPromptBundle(
  kind: PromptBundleKind,
  prompt: string,
  character: Character | null,
): PromptBundle {
  const sections = [
    section("PROMPT", prompt),
    section("character.schema.json", asJson(characterJsonSchema)),
  ];
  const attachments: Record<string, unknown> = {
    "character.schema.json": characterJsonSchema,
  };

  if (character) {
    sections.push(section("character.json", asJson(character)));
    attachments["character.json"] = character;
  }
  if (kind === "migrate") {
    sections.push(section("schema-changelog.md", SCHEMA_CHANGELOG));
    attachments["schema-changelog.md"] = SCHEMA_CHANGELOG;
  }

  return { text: sections.join("\n\n"), attachments };
}

export function promptBundleFilename(kind: PromptBundleKind): string {
  return `jugale-${kind}-prompt.txt`;
}
