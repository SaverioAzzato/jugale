import type { Character } from "../schema";
import { Panel } from "./primitives";
import { useT, type StringKey } from "../i18n/useI18n";

/** Bio / vital statistics from the identity block (only the fields that are set). */
export function BioSection({ c }: { c: Character }) {
  const t = useT();
  const rows: [StringKey, string][] = [
    ["bio.alignment", c.identity.alignment],
    ["bio.size", c.identity.size],
    ["bio.age", c.identity.age],
  ];
  const present = rows.filter(([, v]) => v && v.trim().length > 0);
  if (present.length === 0) return null;
  return (
    <Panel title={t("bio.title")} id="bio">
      <dl className="kv">
        {present.map(([key, value]) => (
          <div key={key} className="kv-row">
            <dt>{t(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function ProficienciesSection({ c }: { c: Character }) {
  const t = useT();
  const p = c.proficiencies;
  const groups: [StringKey, string[]][] = [
    ["prof.armor", p.armor],
    ["prof.weapons", p.weapons],
    ["prof.tools", p.tools],
    ["prof.languages", p.languages],
  ];
  if (groups.every(([, v]) => v.length === 0)) return null;
  return (
    <Panel title={t("prof.title")} id="proficiencies">
      {groups
        .filter(([, v]) => v.length > 0)
        .map(([key, values]) => (
          <p key={key} className="prof-line">
            <strong>{t(key)}:</strong> {values.join(", ")}
          </p>
        ))}
    </Panel>
  );
}

export function OriginSection({ c }: { c: Character }) {
  const t = useT();
  const o = c.origin;
  if (o.raceTraits.length === 0 && !o.backgroundFeature) return null;
  return (
    <Panel title={t("origin.title")} id="origin">
      {o.raceTraits.length > 0 && (
        <ul className="feature-list">
          {o.raceTraits.map((trait, i) => (
            <li key={i}>
              {trait.name ? <strong>{trait.name}</strong> : null}
              {trait.name && trait.description ? ": " : ""}
              {trait.description}
            </li>
          ))}
        </ul>
      )}
      {o.backgroundFeature && (
        <p>
          <strong>{o.backgroundFeature.name}</strong>
          {o.backgroundFeature.description ? `: ${o.backgroundFeature.description}` : ""}
        </p>
      )}
    </Panel>
  );
}

export function NarrativeSection({ c }: { c: Character }) {
  const t = useT();
  const n = c.narrative;
  const blocks: [StringKey, string[]][] = [
    ["narrative.personality", n.personality],
    ["narrative.ideals", n.ideals],
    ["narrative.bonds", n.bonds],
    ["narrative.flaws", n.flaws],
    ["narrative.appearance", n.appearance],
    ["narrative.backstory", n.backstory],
    ["narrative.notes", n.notes],
  ];
  if (blocks.every(([, v]) => v.length === 0)) return null;
  return (
    <Panel title={t("narrative.title")} id="narrative">
      {blocks
        .filter(([, v]) => v.length > 0)
        .map(([key, values]) => (
          <div key={key} className="narrative-block">
            <h3>{t(key)}</h3>
            <ul className="bullets">
              {values.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        ))}
    </Panel>
  );
}
