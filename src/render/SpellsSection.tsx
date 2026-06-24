import { useState } from "react";
import { type AbilityId, type Character, type SpellEntry } from "../schema";
import { spellSaveDc, spellAttackBonus } from "../schema";
import { Caret, Panel, WikiLink, fmtMod } from "./primitives";
import { useT } from "../i18n/useI18n";
import { useSettings, type UnitSystem } from "../ui/useSettings";
import { convertDistanceText } from "../model/units";

/** The one-liner you read at the table when the spell is collapsed. */
function spellLine(s: SpellEntry, units: UnitSystem): string {
  return [convertDistanceText(s.range, units), s.attack, s.defense, s.effect]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(" · ");
}

/** description and notes are one concept now — show them merged. */
function mergedText(s: SpellEntry): string {
  return [s.description?.trim(), s.notes?.trim()].filter(Boolean).join("\n\n");
}

function SpellRow({ s }: { s: SpellEntry }) {
  const t = useT();
  const units = useSettings((settings) => settings.units);
  const [open, setOpen] = useState(false);
  const text = mergedText(s);
  return (
    <li className="spell">
      <button type="button" className="spell-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Caret open={open} />
        <span className="attack-main">
          <span className="attack-name">
            {s.name}
            {s.concentration && <span className="attack-tag">{t("spells.concentration")}</span>}
          </span>
          <span className="attack-summary">{spellLine(s, units)}</span>
        </span>
      </button>
      {open && (
        <div className="attack-body">
          {s.link && (
            <p className="attack-link">
              <WikiLink link={s.link}>{t("detail.openWiki")}</WikiLink>
            </p>
          )}
          <dl className="attack-profile">
            {s.school && <div className="detail-row"><dt>{t("spells.school")}</dt><dd>{s.school}</dd></div>}
            {s.castingTime && <div className="detail-row"><dt>{t("spells.castingTime")}</dt><dd>{s.castingTime}</dd></div>}
            {s.range && <div className="detail-row"><dt>{t("detail.range")}</dt><dd>{convertDistanceText(s.range, units)}</dd></div>}
            {s.area && <div className="detail-row"><dt>{t("spells.area")}</dt><dd>{convertDistanceText(s.area, units)}</dd></div>}
            {s.duration && (
              <div className="detail-row">
                <dt>{t("spells.duration")}</dt>
                <dd>{convertDistanceText(s.duration, units)}{s.concentration ? ` · ${t("spells.concentrationFull")}` : ""}</dd>
              </div>
            )}
            {s.components && <div className="detail-row"><dt>{t("spells.components")}</dt><dd>{s.components}</dd></div>}
            {s.attack && <div className="detail-row"><dt>{t("detail.yourRoll")}</dt><dd>{s.attack}</dd></div>}
            {s.defense && <div className="detail-row"><dt>{t("detail.enemyRoll")}</dt><dd>{s.defense}</dd></div>}
            {s.effect && <div className="detail-row"><dt>{t("detail.damageEffect")}</dt><dd>{s.effect}</dd></div>}
          </dl>
          {text && <p className="spell-desc">{text}</p>}
        </div>
      )}
    </li>
  );
}

export function SpellsSection({ c }: { c: Character }) {
  const t = useT();
  if (c.spellSections.length === 0) return null;
  const casters = c.classes.filter((cl) => cl.spellcasting.ability);

  return (
    <Panel title={t("spells.title")} id="spells">
      {casters.length > 0 && (
        <p className="caster-summary">
          {casters.map((cl, i) => {
            const ability = cl.spellcasting.ability as AbilityId;
            return (
              <span key={i}>
                {i > 0 ? " · " : ""}
                <strong>{cl.name}</strong>: {t("spells.dc")} {spellSaveDc(c, ability)}, {t("spells.attack")}{" "}
                {fmtMod(spellAttackBonus(c, ability))}
              </span>
            );
          })}
        </p>
      )}
      {c.spellSections.map((sec) => (
        <div key={sec.id || sec.title} className="spell-section">
          {sec.title && <h3 className="spell-section-title">{sec.title}</h3>}
          <ul className="spell-list">
            {sec.entries.map((s, i) => (
              <SpellRow key={s.name || i} s={s} />
            ))}
          </ul>
        </div>
      ))}
    </Panel>
  );
}
