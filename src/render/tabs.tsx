import type { Character } from "../schema";
import { AbilitiesSection } from "./AbilitiesSection";
import { SkillsSection } from "./SkillsSection";
import { CombatSection } from "./CombatSection";
import { ResourcesSection } from "./ResourcesSection";
import { SpellsSection } from "./SpellsSection";
import { FeaturesSection } from "./FeaturesSection";
import { InventorySection } from "./InventorySection";
import { ProficienciesSection, OriginSection, NarrativeSection } from "./TextSections";
import { CustomSections } from "./CustomSection";

export interface TabDef {
  id: string;
  label: string;
}

const hasInventory = (c: Character): boolean =>
  c.inventory.items.length > 0 || Object.values(c.inventory.currencies).some((v) => Number(v) > 0);

const hasStory = (c: Character): boolean =>
  c.origin.raceTraits.length > 0 ||
  c.origin.backgroundFeature != null ||
  c.customSections.length > 0 ||
  [
    c.narrative.personality,
    c.narrative.ideals,
    c.narrative.bonds,
    c.narrative.flaws,
    c.narrative.appearance,
    c.narrative.backstory,
    c.narrative.notes,
  ].some((a) => a.length > 0);

/** Tabs are data-driven: Inventario/Storia appear only when they'd have content. */
export function getVisibleTabs(c: Character): TabDef[] {
  const tabs: TabDef[] = [
    { id: "gioco", label: "Gioco" },
    { id: "scheda", label: "Scheda" },
  ];
  if (hasInventory(c)) tabs.push({ id: "inventario", label: "Inventario" });
  if (hasStory(c)) tabs.push({ id: "storia", label: "Storia" });
  return tabs;
}

/** Renders one tab's sections, packed into a gap-free masonry (one column for
 * single-section tabs so they don't render half-width). */
export function TabContent({ c, tab }: { c: Character; tab: string }) {
  switch (tab) {
    case "gioco":
      return (
        <div className="tab-panels">
          <CombatSection c={c} />
          <ResourcesSection c={c} />
          <SpellsSection c={c} />
        </div>
      );
    case "scheda":
      return (
        <div className="tab-panels">
          <AbilitiesSection c={c} />
          <SkillsSection c={c} />
          <ProficienciesSection c={c} />
          <FeaturesSection c={c} />
        </div>
      );
    case "inventario":
      return (
        <div className="tab-panels single">
          <InventorySection c={c} />
        </div>
      );
    case "storia":
      return (
        <div className="tab-panels">
          <OriginSection c={c} />
          <NarrativeSection c={c} />
          <CustomSections c={c} />
        </div>
      );
    default:
      return null;
  }
}
