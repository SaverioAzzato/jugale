import type { Character } from "../schema";
import { Panel } from "./primitives";

export function ProficienciesSection({ c }: { c: Character }) {
  const p = c.proficiencies;
  const groups: [string, string[]][] = [
    ["Armature", p.armor],
    ["Armi", p.weapons],
    ["Strumenti", p.tools],
    ["Lingue", p.languages],
  ];
  if (groups.every(([, v]) => v.length === 0)) return null;
  return (
    <Panel title="Competenze" id="proficiencies">
      {groups
        .filter(([, v]) => v.length > 0)
        .map(([label, values]) => (
          <p key={label} className="prof-line">
            <strong>{label}:</strong> {values.join(", ")}
          </p>
        ))}
    </Panel>
  );
}

export function OriginSection({ c }: { c: Character }) {
  const o = c.origin;
  if (o.raceTraits.length === 0 && !o.backgroundFeature) return null;
  return (
    <Panel title="Origine" id="origin">
      {o.raceTraits.length > 0 && (
        <ul className="feature-list">
          {o.raceTraits.map((t, i) => (
            <li key={i}>
              {t.name ? <strong>{t.name}</strong> : null}
              {t.name && t.description ? ": " : ""}
              {t.description}
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
  const n = c.narrative;
  const blocks: [string, string[]][] = [
    ["Personalità", n.personality],
    ["Ideali", n.ideals],
    ["Legami", n.bonds],
    ["Difetti", n.flaws],
    ["Aspetto", n.appearance],
    ["Storia", n.backstory],
    ["Note", n.notes],
  ];
  if (blocks.every(([, v]) => v.length === 0)) return null;
  return (
    <Panel title="Personalità e Storia" id="narrative">
      {blocks
        .filter(([, v]) => v.length > 0)
        .map(([label, values]) => (
          <div key={label} className="narrative-block">
            <h3>{label}</h3>
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
