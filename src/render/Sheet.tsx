import type { Character } from "../schema";
import { proficiencyBonus } from "../schema";
import { fmtMod } from "./primitives";
import { TabContent } from "./tabs";
import { useCharacter } from "../state/store";
import { useT } from "../i18n/useI18n";

/**
 * The character identity header (always visible) + the active tab's sections.
 * Name + a proficiency chip on the top line, then two compact subtitle lines
 * (class/level, then race · background). Any longer description lives in the
 * Story tab. The tab bar itself lives in the app's sticky header (App.tsx).
 */
export function Sheet({ c, tab }: { c: Character; tab: string }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  const editField = useCharacter((s) => s.editField);
  const classLine = c.classes
    .map((cl) => `${cl.name}${cl.subclass ? ` (${cl.subclass})` : ""} ${cl.level}`)
    .join(" / ");
  const originLine = [c.identity.race, c.identity.background].filter(Boolean).join(" · ");

  return (
    <article className="sheet">
      <header className="sheet-header">
        <div className="sheet-headline">
          <h1>
            {editMode ? (
              <input
                className="edit-input edit-name"
                value={c.meta.name}
                aria-label={t("edit.name")}
                onChange={(e) => editField(["meta", "name"], e.target.value)}
              />
            ) : (
              c.meta.name
            )}
          </h1>
          <span className="pb-chip" title={t("header.proficiency")}>
            {t("header.profShort")} {fmtMod(proficiencyBonus(c))}
          </span>
        </div>
        {classLine && <p className="subtitle">{classLine}</p>}
        {originLine && <p className="subtitle subtitle-2">{originLine}</p>}
      </header>

      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <TabContent c={c} tab={tab} />
      </div>
    </article>
  );
}
