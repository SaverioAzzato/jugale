import type { StringKey } from "../i18n/useI18n";
import type { Character } from "../schema";

export interface TabDef {
  id: string;
  labelKey: StringKey;
}

const hasInventory = (character: Character): boolean =>
  character.inventory.items.length > 0 ||
  Object.values(character.inventory.currencies).some((value) => Number(value) > 0);

const hasStory = (character: Character): boolean =>
  (character.meta.summary?.trim().length ?? 0) > 0 ||
  character.origin.raceTraits.length > 0 ||
  character.origin.backgroundFeature != null ||
  character.customSections.length > 0 ||
  [character.identity.alignment, character.identity.size, character.identity.age]
    .some((value) => value && value.trim().length > 0) ||
  [
    character.narrative.personality,
    character.narrative.ideals,
    character.narrative.bonds,
    character.narrative.flaws,
    character.narrative.appearance,
    character.narrative.backstory,
    character.narrative.notes,
  ].some((entries) => entries.length > 0);

/** Return the data-driven tabs that currently have content or are editable. */
export function getVisibleTabs(character: Character, hasImages = false, editMode = false): TabDef[] {
  const tabs: TabDef[] = [
    { id: "gioco", labelKey: "tab.gioco" },
    { id: "scheda", labelKey: "tab.scheda" },
  ];
  if (editMode || hasInventory(character)) tabs.push({ id: "inventario", labelKey: "tab.inventario" });
  if (editMode || hasImages || hasStory(character)) tabs.push({ id: "storia", labelKey: "tab.storia" });
  return tabs;
}
