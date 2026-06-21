import { type AbilityId, type Character } from "../schema";
import { spellSaveDc, spellAttackBonus } from "../schema";
import { Panel, DataTable, WikiLink, fmtMod } from "./primitives";

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
        <DataTable
          key={sec.id || sec.title}
          caption={sec.title}
          headers={["Incantesimo", "Liv", "Gittata", "Tiro che fai tu", "Tiro avversario", "Danno/Effetto", "Conc."]}
          rows={sec.entries.map((s) => [
            <span>
              <WikiLink link={s.link}>{s.name}</WikiLink>
              {s.notes ? <small className="muted"> — {s.notes}</small> : null}
            </span>,
            s.level,
            s.range,
            s.attack,
            s.defense,
            s.effect,
            s.concentration ? "Sì" : "—",
          ])}
        />
      ))}
    </Panel>
  );
}
