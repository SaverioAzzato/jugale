import type { Character } from "../schema";
import { Panel, WikiLink } from "./primitives";
import { Stepper } from "./controls";
import { useCharacter } from "../state/store";
import { useT, type StringKey } from "../i18n/useI18n";

const RESET_KEY: Record<string, StringKey> = {
  shortRest: "reset.shortRest",
  longRest: "reset.longRest",
  dawn: "reset.dawn",
  manual: "reset.manual",
  none: "reset.none",
};

export function ResourcesSection({ c }: { c: Character }) {
  const t = useT();
  const adjustResource = useCharacter((s) => s.adjustResource);
  if (c.resources.length === 0) return null;

  return (
    <Panel title={t("resources.title")} id="resources">
      <ul className="resource-list">
        {c.resources.map((r) => {
          const pips = Math.min(r.max, 24);
          return (
            <li key={r.id} className="resource">
              <div className="resource-head">
                <WikiLink link={r.link}>
                  <span className="resource-label">{r.label || r.id}</span>
                </WikiLink>
                <Stepper
                  value={r.current}
                  min={0}
                  max={r.max}
                  label={r.label || r.id}
                  onChange={(next) => adjustResource(r.id, next - r.current)}
                />
              </div>
              {pips > 0 && (
                <div className="pips" aria-hidden>
                  {Array.from({ length: pips }).map((_, i) => (
                    <span key={i} className={i < r.current ? "pip is-on" : "pip"} />
                  ))}
                </div>
              )}
              <span className="resource-meta">
                {r.current}/{r.max} · {t("resources.reset")}: {t(RESET_KEY[r.resetOn] ?? "reset.none")}
                {r.level ? ` · ${t("resources.level")} ${r.level}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
