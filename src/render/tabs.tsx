import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Character } from "../schema";
import { AbilitiesSection } from "./AbilitiesSection";
import { SkillsSection } from "./SkillsSection";
import { CombatSection } from "./CombatSection";
import { ActionsSection } from "./ActionsSection";
import { StatusSection } from "./StatusSection";
import { AttacksSection } from "./AttacksSection";
import { ConsumablesSection } from "./ConsumablesSection";
import { ResourcesSection } from "./ResourcesSection";
import { SpellsSection } from "./SpellsSection";
import { FeaturesSection } from "./FeaturesSection";
import { InventorySection } from "./InventorySection";
import { PortraitSection } from "./PortraitSection";
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

/** Tabs are data-driven: Inventario/Storia appear only when they'd have content
 *  (Storia also shows when a loaded folder supplied images, even with no prose). */
export function getVisibleTabs(c: Character, hasImages = false): TabDef[] {
  const tabs: TabDef[] = [
    { id: "gioco", labelKey: "tab.gioco" },
    { id: "scheda", labelKey: "tab.scheda" },
  ];
  if (hasInventory(c)) tabs.push({ id: "inventario", labelKey: "tab.inventario" });
  if (hasImages || hasStory(c)) tabs.push({ id: "storia", labelKey: "tab.storia" });
  return tabs;
}

const COMBAT_CATEGORIES = new Set(["ammo", "consumable", "potion"]);

interface Section {
  key: string;
  node: ReactNode;
}

/** Keep the present sections (conditional ones arrive as false/null). */
function sections(list: (Section | false | null | undefined)[]): Section[] {
  return list.filter(Boolean) as Section[];
}

function initialSplit(items: Section[]): [string[], string[]] {
  const l: string[] = [];
  const r: string[] = [];
  items.forEach((it, i) => (i % 2 === 0 ? l : r).push(it.key));
  return [l, r];
}

const eqSplit = (a: [string[], string[]], b: [string[], string[]]) =>
  a[0].join("|") === b[0].join("|") && a[1].join("|") === b[1].join("|");

/** True at the two-column breakpoint (mirrors the ≤760px CSS collapse). */
function useTwoColumn(): boolean {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [two, setTwo] = useState(() => (supported ? window.matchMedia("(min-width: 761px)").matches : true));
  useEffect(() => {
    if (!supported) return;
    const mq = window.matchMedia("(min-width: 761px)");
    const on = () => setTwo(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [supported]);
  return two;
}

/**
 * Two height-balanced columns: each section is greedily placed in the currently shorter
 * column (measured), so the two sides end up roughly even instead of curated by hand.
 * Rebalances only on mount, tab/character change, and when crossing into two-column width —
 * never on expand, so opening a card grows only its own column and nothing jumps around.
 */
function BalancedCols({ items }: { items: Section[] }) {
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const twoCol = useTwoColumn();
  const sig = items.map((i) => i.key).join("|");
  const [split, setSplit] = useState<[string[], string[]]>(() => initialSplit(items));

  useLayoutEffect(() => {
    if (!twoCol) return;
    const h = (k: string) => refs.current.get(k)?.offsetHeight ?? 0;
    let hl = 0;
    let hr = 0;
    const l: string[] = [];
    const r: string[] = [];
    for (const it of items) {
      if (hl <= hr) {
        l.push(it.key);
        hl += h(it.key);
      } else {
        r.push(it.key);
        hr += h(it.key);
      }
    }
    setSplit((prev) => (eqSplit(prev, [l, r]) ? prev : [l, r]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, twoCol]);

  if (items.length === 0) return null;

  const byKey = new Map(items.map((i) => [i.key, i.node]));
  const col = (keys: string[]) =>
    keys.map((k) => (
      <div
        className="bcol-item"
        key={k}
        ref={(el) => {
          if (el) refs.current.set(k, el);
          else refs.current.delete(k);
        }}
      >
        {byKey.get(k)}
      </div>
    ));

  // Single centered column when narrow or trivial — render in priority order.
  if (!twoCol || items.length === 1) {
    return <div className="tab-col tab-col-solo">{col(items.map((i) => i.key))}</div>;
  }

  // Guard against a stale split from the previous tab until the layout effect recomputes.
  const known = new Set(items.map((i) => i.key));
  const valid =
    split[0].length + split[1].length === items.length &&
    [...split[0], ...split[1]].every((k) => known.has(k));
  const [left, right] = valid ? split : initialSplit(items);

  return (
    <div className="tab-cols">
      <div className="tab-col">{col(left)}</div>
      <div className="tab-col">{col(right)}</div>
    </div>
  );
}

/** Renders one tab's sections into two height-balanced columns (priority order is the input
 *  order; the balancer decides which side each lands on). Inventory stays a single column. */
export function TabContent({ c, tab }: { c: Character; tab: string }) {
  switch (tab) {
    case "gioco": {
      const hasAttacks = c.inventory.items.some((it) => it.attacks.length > 0) || c.combat.attacks.length > 0;
      const hasConsumables = c.inventory.items.some((it) => COMBAT_CATEGORIES.has((it.category || "").toLowerCase()));
      return (
        <BalancedCols
          items={sections([
            { key: "vitals", node: <CombatSection c={c} /> },
            hasAttacks && { key: "attacks", node: <AttacksSection c={c} /> },
            c.spellSections.length > 0 && { key: "spells", node: <SpellsSection c={c} /> },
            c.resources.length > 0 && { key: "resources", node: <ResourcesSection c={c} /> },
            { key: "actions", node: <ActionsSection c={c} /> },
            { key: "status", node: <StatusSection c={c} /> },
            hasConsumables && { key: "consumables", node: <ConsumablesSection c={c} /> },
          ])}
        />
      );
    }
    case "scheda":
      return (
        <BalancedCols
          items={sections([
            { key: "abilities", node: <AbilitiesSection c={c} /> },
            { key: "skills", node: <SkillsSection c={c} /> },
            { key: "features", node: <FeaturesSection c={c} /> },
            { key: "prof", node: <ProficienciesSection c={c} /> },
          ])}
        />
      );
    case "inventario":
      return <div className="tab-col tab-col-solo"><InventorySection c={c} /></div>;
    case "storia":
      return (
        <BalancedCols
          items={sections([
            { key: "portrait", node: <PortraitSection c={c} /> },
            { key: "description", node: <DescriptionSection c={c} /> },
            { key: "bio", node: <BioSection c={c} /> },
            { key: "narrative", node: <NarrativeSection c={c} /> },
            { key: "origin", node: <OriginSection c={c} /> },
            { key: "custom", node: <CustomSections c={c} /> },
          ])}
        />
      );
    default:
      return null;
  }
}
