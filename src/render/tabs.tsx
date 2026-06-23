import type { ReactNode } from "react";
import type { Character } from "../schema";
import { AbilitiesSection } from "./AbilitiesSection";
import { SkillsSection } from "./SkillsSection";
import { CombatSection } from "./CombatSection";
import { StatusSection } from "./StatusSection";
import { AttacksSection } from "./AttacksSection";
import { ConsumablesSection } from "./ConsumablesSection";
import { ResourcesSection } from "./ResourcesSection";
import { SpellsSection } from "./SpellsSection";
import { FeaturesSection } from "./FeaturesSection";
import { InventorySection } from "./InventorySection";
import { DescriptionSection, BioSection, ProficienciesSection, OriginSection, NarrativeSection } from "./TextSections";
import { CustomSections } from "./CustomSection";

import type { StringKey } from "../i18n/useI18n";

export interface TabDef {
  id: string;
  labelKey: StringKey;
}

const hasInventory = (c: Character): boolean =>
  c.inventory.items.length > 0 || Object.values(c.inventory.currencies).some((v) => Number(v) > 0);

const hasStory = (c: Character): boolean =>
  (c.meta.summary?.trim().length ?? 0) > 0 ||
  c.origin.raceTraits.length > 0 ||
  c.origin.backgroundFeature != null ||
  c.customSections.length > 0 ||
  [c.identity.alignment, c.identity.size, c.identity.age].some((v) => v && v.trim().length > 0) ||
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
    { id: "gioco", labelKey: "tab.gioco" },
    { id: "scheda", labelKey: "tab.scheda" },
  ];
  if (hasInventory(c)) tabs.push({ id: "inventario", labelKey: "tab.inventario" });
  if (hasStory(c)) tabs.push({ id: "storia", labelKey: "tab.storia" });
  return tabs;
}

const COMBAT_CATEGORIES = new Set(["ammo", "consumable", "potion"]);

/** Two stable columns: each panel keeps its column regardless of height, so
 *  expanding a row grows only its own column and nothing jumps around. Collapses
 *  to a single centered column when one side is empty or the viewport is narrow. */
function Cols({ left, right }: { left: ReactNode[]; right: ReactNode[] }) {
  const l = left.filter(Boolean);
  const r = right.filter(Boolean);
  if (l.length === 0 && r.length === 0) return null;
  if (r.length === 0) return <div className="tab-col tab-col-solo">{l}</div>;
  if (l.length === 0) return <div className="tab-col tab-col-solo">{r}</div>;
  return (
    <div className="tab-cols">
      <div className="tab-col">{l}</div>
      <div className="tab-col">{r}</div>
    </div>
  );
}

/** Renders one tab's sections into stable, curated columns. */
export function TabContent({ c, tab }: { c: Character; tab: string }) {
  switch (tab) {
    case "gioco": {
      const hasAttacks = c.inventory.items.some((it) => it.attacks.length > 0) || c.combat.attacks.length > 0;
      const hasConsumables = c.inventory.items.some((it) => COMBAT_CATEGORIES.has((it.category || "").toLowerCase()));
      return (
        <Cols
          left={[
            <CombatSection key="vitals" c={c} />,
            <StatusSection key="status" c={c} />,
            c.resources.length > 0 && <ResourcesSection key="resources" c={c} />,
          ]}
          right={[
            hasAttacks && <AttacksSection key="attacks" c={c} />,
            c.spellSections.length > 0 && <SpellsSection key="spells" c={c} />,
            hasConsumables && <ConsumablesSection key="consumables" c={c} />,
          ]}
        />
      );
    }
    case "scheda":
      return (
        <Cols
          left={[<AbilitiesSection key="abilities" c={c} />, <ProficienciesSection key="prof" c={c} />]}
          right={[<SkillsSection key="skills" c={c} />, <FeaturesSection key="features" c={c} />]}
        />
      );
    case "inventario":
      return <Cols left={[<InventorySection key="inv" c={c} />]} right={[]} />;
    case "storia":
      return (
        <Cols
          left={[
            <DescriptionSection key="description" c={c} />,
            <BioSection key="bio" c={c} />,
            <NarrativeSection key="narrative" c={c} />,
          ]}
          right={[<OriginSection key="origin" c={c} />, <CustomSections key="custom" c={c} />]}
        />
      );
    default:
      return null;
  }
}
