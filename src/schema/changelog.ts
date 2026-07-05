import { SCHEMA_VERSION } from "./character";

/**
 * The schema changelog — a cumulative, human- and machine-readable list of what changed at each
 * `character.json` schema bump. Published (downloadable from the Prompts page as `schema-changelog.md`)
 * so an external chatbot can migrate an older file: paired with the "Migrate to current schema" prompt
 * and `character.schema.json`, it says WHAT changed and IN WHICH ORDER.
 *
 * It is *reference data*, not a prompt — a short usage header only, no base prompt baked in.
 * This mirrors `docs/SCHEMA.md §4` (the human doc); keep the two in sync on every schema change,
 * and add a new `x → y` section here whenever `SCHEMA_VERSION` bumps (guarded by `changelog.test.ts`).
 */
export const SCHEMA_CHANGELOG = `# character.json — schema changelog

Cumulative list of what changed at each schema bump. Pair this file with **character.schema.json**
(the exact target shape) and the "Migrate to current schema" prompt: read the file's \`schemaVersion\`,
then apply the sections below **in order**, from that version up to the current one
(**${SCHEMA_VERSION}**), carrying every other field forward untouched. If \`schemaVersion\` already
equals the current one, there is nothing to do.

## 1.0.0 → 2.0.0 (v1 → v2 restructure)
- \`identity[]\` (label/value pairs) → an \`identity\` object **plus** a \`classes[]\` array (multiclass-native). The level may be embedded in the class text ("Warlock 4") or in a separate "Level" entry.
- \`build.abilities\`/\`baseStats\` (string scores, "+0" modifiers) → an \`abilities\` object with numeric \`score\` (ability modifiers are derived, never stored). Saving-throw proficiency → \`abilities.<id>.saveProficient\`.
- \`build.skills\` (flagged "competente"/proficient) → \`proficiencies.skills[]\` as \`{ id, proficient }\`.
- \`session.resources.slots\` dict (\`{ total, used }\`) → \`resources[]\` entries (\`{ max, current, category: "spellSlot", resetOn }\`); \`arrows\` → a \`category: "ammo"\` resource.
- The dead root \`spellcasting\` field is removed; any freeform slot summary is preserved as a \`customSections\` text block. \`spellSections[]\` entries gain optional \`school\`/\`castingTime\`/\`components\`/\`duration\`/\`description\`.
- v1 \`origin.languages\` → \`proficiencies.languages\` (languages' single home).
- \`features.items\` + \`features.levelChecklist\` → \`features[]\` (plus a \`customSections\` checklist if one was present).
- Every unknown/extra field is preserved under the nearest section or as a \`customSections\` entry — nothing is dropped.

## 2.0.0 → 2.1.0 (structured spells)
- \`castingTime\`: string → object \`{ type, value, condition }\`. Examples: \`"1 bonus action"\` → \`{ type: "bonus" }\`; \`"10 minutes"\` → \`{ type: "time", value: "10 minutes" }\`; a reaction's trailing trigger → \`condition\`.
- \`components\`: string → object \`{ verbal, somatic, material }\`. Any material detail in a trailing parenthetical (\`"V, S, M (a pearl worth 300 gp)"\`) moves into \`materials[]\` as \`{ text, cost, consumable }\` — parse a \`… gp/mo\` cost and a "consumable" hint.
- Fold the old per-spell \`notes\` into \`description\` (one free-text field now) and remove \`notes\`.
- \`ritual\` (boolean), \`damageType\`, and \`higherLevels\` are added; they default in via the schema, so no manual action is needed.

## 2.1.0 → 2.2.0 (Armor Class)
- Remove the flat \`combat.armorClass\` field entirely — it no longer exists.
- AC now derives from: \`combat.armorClassOverride\` (a manual value that wins) → else the base of the single worn body-armor item (\`ac.base\` plus Dex per \`addDex\`/\`dexCap\`), or **10 + Dex modifier** when unarmored → then every equipped item's \`ac.bonus\` (shields, rings) stacks on top.
- Preserve the *shown* AC: \`combat.armorClass\` was already ignored whenever an override or an equipped \`ac\` item existed. Only when there was **no** override and **no** equipped \`ac\` item was it the effective value — in that case move it into \`combat.armorClassOverride\`, and even then only if it differed from the new default of 10 (a bare 10 equals the default → just drop it).
- Only one body armor (an item whose \`ac.base\` is set) may be equipped at a time; shields/rings are bonus-only and always stack.
`;
