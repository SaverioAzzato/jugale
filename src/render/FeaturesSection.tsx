import type { Character } from "../schema";
import { Panel, WikiLink } from "./primitives";

const SOURCE: Record<string, string> = {
  class: "classe",
  subclass: "sottoclasse",
  race: "razza",
  background: "background",
  feat: "talento",
  item: "oggetto",
  custom: "custom",
};

export function FeaturesSection({ c }: { c: Character }) {
  if (c.features.length === 0) return null;
  return (
    <Panel title="Privilegi e Talenti" id="features">
      <ul className="feature-list">
        {c.features.map((f) => (
          <li key={f.id || f.name}>
            <WikiLink link={f.link}>
              <strong>{f.name}</strong>
            </WikiLink>
            <span className="muted">
              {" "}
              ({SOURCE[f.source]}
              {f.level ? `, liv. ${f.level}` : ""})
            </span>
            {f.description ? <p className="feature-desc">{f.description}</p> : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
