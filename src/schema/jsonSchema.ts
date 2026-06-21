import { zodToJsonSchema } from "zod-to-json-schema";
import { CharacterSchema } from "./character";

/**
 * JSON Schema export of the character contract. Published for external tools and
 * GPTs so a chatbot knows exactly how to write `character.json` by hand.
 */
export const characterJsonSchema = zodToJsonSchema(CharacterSchema, "Character");
