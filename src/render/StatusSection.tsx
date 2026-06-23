import { useState } from "react";
import type { Character } from "../schema";
import { Panel } from "./primitives";
import { useCharacter } from "../state/store";

function DeathSaves({ saves }: { saves: Character["session"]["deathSaves"] }) {
  const setDeathSave = useCharacter((s) => s.setDeathSave);
  const Pips = ({ kind, tone }: { kind: "successes" | "failures"; tone: string }) => {
    const value = saves[kind];
    return (
      <div className="death-row">
        <span className="death-label">{kind === "successes" ? "Successi" : "Fallimenti"}</span>
        <span className="death-pips">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className={`death-pip ${n <= value ? `is-on ${tone}` : ""}`}
              aria-label={`${kind} ${n}`}
              // click the current count to clear back down to it-1, else set to n
              onClick={() => setDeathSave(kind, value === n ? n - 1 : n)}
            />
          ))}
        </span>
      </div>
    );
  };
  return (
    <div className="death-saves">
      <p className="status-sub">Tiri salvezza contro la morte</p>
      <Pips kind="successes" tone="is-ok" />
      <Pips kind="failures" tone="is-bad" />
    </div>
  );
}

/** Secondary play-state: conditions (addable on the spot), inspiration, and death
 *  saves shown only when relevant (HP at 0). Deliberately not front-and-center. */
export function StatusSection({ c }: { c: Character }) {
  const addCondition = useCharacter((s) => s.addCondition);
  const removeCondition = useCharacter((s) => s.removeCondition);
  const toggleInspiration = useCharacter((s) => s.toggleInspiration);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const dying = c.combat.hp.current <= 0 && c.combat.hp.max > 0;

  const submit = () => {
    addCondition(draft);
    setDraft("");
    setAdding(false);
  };

  return (
    <Panel title="Stato" id="status">
      <div className="conditions">
        {c.session.conditions.map((name) => (
          <span key={name} className="condition-chip">
            {name}
            <button type="button" aria-label={`rimuovi ${name}`} onClick={() => removeCondition(name)}>
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <input
            className="condition-input"
            autoFocus
            value={draft}
            placeholder="condizione…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={() => (draft.trim() ? submit() : setAdding(false))}
          />
        ) : (
          <button type="button" className="condition-add" onClick={() => setAdding(true)}>
            + condizione
          </button>
        )}
      </div>

      <button
        type="button"
        className={c.session.inspiration ? "inspiration is-on" : "inspiration"}
        aria-pressed={c.session.inspiration}
        onClick={toggleInspiration}
      >
        ★ Ispirazione
      </button>

      {dying && <DeathSaves saves={c.session.deathSaves} />}
    </Panel>
  );
}
