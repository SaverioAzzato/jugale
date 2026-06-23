import type { Character } from "../schema";
import { proficiencyBonus } from "../schema";
import { fmtMod } from "./primitives";
import { TabContent } from "./tabs";
import { useT } from "../i18n/useI18n";

/**
 * The character identity header (always visible) + the active tab's sections.
 * The header stays minimal — just the name and one compact subtitle line
 * (class/level · race · background · proficiency). Any longer description lives
 * in the Story tab. The tab bar itself lives in the app's sticky header (App.tsx).
 */
export function Sheet({ c, tab }: { c: Character; tab: string }) {
  const t = useT();
  const classLine = c.classes
    .map((cl) => `${cl.name}${cl.subclass ? ` (${cl.subclass})` : ""} ${cl.level}`)
    .join(" / ");
  const subtitle = [
    classLine,
    c.identity.race,
    c.identity.background,
    `${t("header.profShort")} ${fmtMod(proficiencyBonus(c))}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="sheet">
      <header className="sheet-header">
        <h1>{c.meta.name}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </header>

      <TabContent c={c} tab={tab} />
    </article>
  );
}
