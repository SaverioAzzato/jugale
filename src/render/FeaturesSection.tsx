import type { Character } from "../schema";
import { Panel, WikiLink } from "./primitives";
import { useT, type StringKey } from "../i18n/useI18n";

export function FeaturesSection({ c }: { c: Character }) {
  const t = useT();
  if (c.features.length === 0) return null;
  return (
    <Panel title={t("features.title")} id="features">
      <ul className="feature-list">
        {c.features.map((f) => (
          <li key={f.id || f.name}>
            <WikiLink link={f.link}>
              <strong>{f.name}</strong>
            </WikiLink>
            <span className="muted">
              {" "}
              ({t(`source.${f.source}` as StringKey)}
              {f.level ? `, ${t("features.level")} ${f.level}` : ""})
            </span>
            {f.description ? <p className="feature-desc">{f.description}</p> : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
