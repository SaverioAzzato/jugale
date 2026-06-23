import type { ReactNode } from "react";
import type { Character } from "../schema";
import { totalLevel, proficiencyBonus } from "../schema";
import { fmtMod } from "./primitives";
import { TabContent } from "./tabs";
import { useT } from "../i18n/useI18n";

function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="header-stat">
      <span className="header-stat-label">{label}</span>
      <strong className="header-stat-value">{value}</strong>
    </div>
  );
}

/**
 * The character identity header (always visible) + the active tab's sections.
 * The tab bar itself lives in the app's sticky header (App.tsx).
 */
export function Sheet({ c, tab }: { c: Character; tab: string }) {
  const t = useT();
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
          <HeaderStat label={t("header.level")} value={totalLevel(c) || "—"} />
          <HeaderStat label={t("header.proficiency")} value={fmtMod(proficiencyBonus(c))} />
        </div>
      </header>

      <TabContent c={c} tab={tab} />
    </article>
  );
}
