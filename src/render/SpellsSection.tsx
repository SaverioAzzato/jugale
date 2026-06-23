import { useState } from "react";
import { type AbilityId, type Character, type SpellEntry } from "../schema";
import { spellSaveDc, spellAttackBonus } from "../schema";
import { Panel, WikiLink, fmtMod } from "./primitives";

/** The one-liner you read at the table when the spell is collapsed. */
function spellLine(s: SpellEntry): string {
  return [s.range, s.attack, s.defense, s.effect].map((x) => x?.trim()).filter(Boolean).join(" · ");
}

/** description and notes are one concept now — show them merged. */
function mergedText(s: SpellEntry): string {
  return [s.description?.trim(), s.notes?.trim()].filter(Boolean).join("\n\n");
}

function SpellRow({ s }: { s: SpellEntry }) {
  const [open, setOpen] = useState(false);
  const text = mergedText(s);
  return (
    <li className="spell">
      <button type="button" className="spell-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="attack-caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="attack-main">
          <span className="attack-name">
            {s.name}
            {s.concentration && <span className="attack-tag">conc.</span>}
          </span>
          <span className="attack-summary">{spellLine(s)}</span>
        </span>
      </button>
      {open && (
        <div className="attack-body">
          {s.link && (
            <p className="attack-link">
              <WikiLink link={s.link}>Apri sul wiki ↗</WikiLink>
            </p>
          )}
          <dl className="attack-profile">
            {s.school && <div className="detail-row"><dt>Scuola</dt><dd>{s.school}</dd></div>}
            {s.castingTime && <div className="detail-row"><dt>Tempo di lancio</dt><dd>{s.castingTime}</dd></div>}
            {s.range && <div className="detail-row"><dt>Gittata</dt><dd>{s.range}</dd></div>}
            {s.area && <div className="detail-row"><dt>Area</dt><dd>{s.area}</dd></div>}
            {s.duration && (
              <div className="detail-row">
                <dt>Durata</dt>
                <dd>{s.duration}{s.concentration ? " · concentrazione" : ""}</dd>
              </div>
            )}
            {s.components && <div className="detail-row"><dt>Componenti</dt><dd>{s.components}</dd></div>}
            {s.attack && <div className="detail-row"><dt>Tiro che fai tu</dt><dd>{s.attack}</dd></div>}
            {s.defense && <div className="detail-row"><dt>Tiro avversario</dt><dd>{s.defense}</dd></div>}
            {s.effect && <div className="detail-row"><dt>Danno/Effetto</dt><dd>{s.effect}</dd></div>}
          </dl>
          {text && <p className="spell-desc">{text}</p>}
        </div>
      )}
    </li>
  );
}

export function SpellsSection({ c }: { c: Character }) {
  if (c.spellSections.length === 0) return null;
  const casters = c.classes.filter((cl) => cl.spellcasting.ability);

  return (
    <Panel title="Incantesimi" id="spells">
      {casters.length > 0 && (
        <p className="caster-summary">
          {casters.map((cl, i) => {
            const ability = cl.spellcasting.ability as AbilityId;
            return (
              <span key={i}>
                {i > 0 ? " · " : ""}
                <strong>{cl.name}</strong>: CD {spellSaveDc(c, ability)}, attacco {fmtMod(spellAttackBonus(c, ability))}
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
