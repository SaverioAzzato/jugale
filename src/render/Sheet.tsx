import type { ReactNode } from "react";
import type { Character } from "../schema";
import { totalLevel, proficiencyBonus } from "../schema";
import { fmtMod } from "./primitives";
import { AbilitiesSection } from "./AbilitiesSection";
import { SkillsSection } from "./SkillsSection";
import { CombatSection } from "./CombatSection";
import { ResourcesSection } from "./ResourcesSection";
import { SpellsSection } from "./SpellsSection";
import { FeaturesSection } from "./FeaturesSection";
import { InventorySection } from "./InventorySection";
import { ProficienciesSection, OriginSection, NarrativeSection } from "./TextSections";
import { CustomSections } from "./CustomSection";

function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="header-stat">
      <span className="header-stat-label">{label}</span>
      <strong className="header-stat-value">{value}</strong>
    </div>
  );
}

/**
 * The whole sheet, derived entirely from the character data.
 * Layout is two independent columns (no shared row grid → no vertical gaps),
 * organised by purpose: left = what you act on during play (combat, resources,
 * spells); right = reference (stats, skills, gear, story). Collapses to one
 * column on narrow screens.
 */
export function Sheet({ c }: { c: Character }) {
  const classLine = c.classes
    .map((cl) => `${cl.name}${cl.subclass ? ` (${cl.subclass})` : ""} ${cl.level}`)
    .join(" / ");
  const subtitle = [classLine, c.identity.race, c.identity.background].filter(Boolean).join(" · ");

  return (
    <article className="sheet">
      <header className="sheet-header">
        <div className="sheet-id">
          <h1>{c.meta.name}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
          {c.meta.summary && <p className="muted">{c.meta.summary}</p>}
        </div>
        <div className="header-stats">
          <HeaderStat label="Livello" value={totalLevel(c) || "—"} />
          <HeaderStat label="Competenza" value={fmtMod(proficiencyBonus(c))} />
        </div>
      </header>

      <div className="sheet-columns">
        <div className="sheet-col">
          <CombatSection c={c} />
          <ResourcesSection c={c} />
          <SpellsSection c={c} />
        </div>
        <div className="sheet-col">
          <AbilitiesSection c={c} />
          <SkillsSection c={c} />
          <ProficienciesSection c={c} />
          <FeaturesSection c={c} />
          <InventorySection c={c} />
          <OriginSection c={c} />
          <NarrativeSection c={c} />
          <CustomSections c={c} />
        </div>
      </div>
    </article>
  );
}
