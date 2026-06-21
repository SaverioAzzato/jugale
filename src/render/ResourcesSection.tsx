import type { Character } from "../schema";
import { Panel, WikiLink } from "./primitives";
import { Stepper } from "./controls";
import { useCharacter } from "../state/store";

const RESET: Record<string, string> = {
  shortRest: "riposo breve",
  longRest: "riposo lungo",
  dawn: "alba",
  manual: "manuale",
  none: "—",
};

export function ResourcesSection({ c }: { c: Character }) {
  const adjustResource = useCharacter((s) => s.adjustResource);
  if (c.resources.length === 0) return null;

  return (
    <Panel title="Risorse" id="resources">
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
                {r.current}/{r.max} · reset: {RESET[r.resetOn]}
                {r.level ? ` · liv. ${r.level}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
