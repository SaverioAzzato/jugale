import type { Character } from "../schema";
import { Panel } from "./primitives";
import { useCharacter } from "../state/store";
import { useT } from "../i18n/useI18n";

/**
 * Rests + custom actions, grouped together. Short/Long rest apply the built-in
 * reset and then any registered actions of that kind; custom actions get their own
 * buttons. The formulae themselves are hidden for now — they'll be surfaced (and
 * editable) once Edit mode lands.
 */
export function ActionsSection({ c }: { c: Character }) {
  const t = useT();
  const shortRest = useCharacter((s) => s.shortRest);
  const longRest = useCharacter((s) => s.longRest);
  const runAction = useCharacter((s) => s.runAction);

  const customActions = c.actions.filter((a) => a.kind === "custom");

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
          <button
            key={a.id}
            type="button"
            className="btn"
            title={a.info || undefined}
            onClick={() => runAction(a.id)}
          >
            {a.label || a.id}
          </button>
        ))}
      </div>
    </Panel>
  );
}
