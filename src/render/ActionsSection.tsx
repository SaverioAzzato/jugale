import { useState } from "react";
import type { Character } from "../schema";
import { Panel } from "./primitives";
import { useCharacter } from "../state/store";
import { useT } from "../i18n/useI18n";

/**
 * Rests + custom actions, grouped together. Short/Long rest apply the built-in
 * reset and then any registered actions of that kind; custom actions get their own
 * buttons. A consultable info toggle lists the formulae each action will apply.
 */
export function ActionsSection({ c }: { c: Character }) {
  const t = useT();
  const shortRest = useCharacter((s) => s.shortRest);
  const longRest = useCharacter((s) => s.longRest);
  const runAction = useCharacter((s) => s.runAction);
  const [showInfo, setShowInfo] = useState(false);

  const customActions = c.actions.filter((a) => a.kind === "custom");
  // Actions that carry formulae worth showing in the info panel.
  const documented = c.actions.filter((a) => a.formulas.length > 0);

  const kindLabel = (kind: Character["actions"][number]["kind"]): string =>
    kind === "shortRest" ? t("vitals.shortRest") : kind === "longRest" ? t("vitals.longRest") : "";

  return (
    <Panel title={t("actions.title")} id="actions">
      <div className="action-buttons">
        <button type="button" className="btn" onClick={shortRest}>
          {t("vitals.shortRest")}
        </button>
        <button type="button" className="btn" onClick={longRest}>
          {t("vitals.longRest")}
        </button>
        {customActions.map((a) => (
          <button key={a.id} type="button" className="btn" onClick={() => runAction(a.id)}>
            {a.label || a.id}
          </button>
        ))}
      </div>

      {documented.length > 0 && (
        <>
          <button
            type="button"
            className="action-info-toggle"
            aria-expanded={showInfo}
            onClick={() => setShowInfo((v) => !v)}
          >
            {showInfo ? "▾" : "▸"} {t("actions.formulas")}
          </button>
          {showInfo && (
            <ul className="action-info">
              {documented.map((a) => (
                <li key={a.id}>
                  <span className="action-info-label">
                    {a.label || a.id}
                    {kindLabel(a.kind) && <span className="muted"> · {kindLabel(a.kind)}</span>}
                  </span>
                  {a.info && <p className="action-info-desc">{a.info}</p>}
                  {a.formulas.map((f, i) => (
                    <code key={i} className="action-formula">
                      {f}
                    </code>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}
