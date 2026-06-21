import { useEffect } from "react";
import { useCharacter } from "./state/store";
import { Sheet } from "./render/Sheet";
import type { Issue } from "./schema";
import warlock from "../characters/example-warlock/character.json";
import fighter from "../characters/example-fighter/character.json";
import multiclass from "../characters/example-multiclass/character.json";

const SAMPLES = [
  { key: "warlock", label: "Warlock (Tomo)", data: warlock },
  { key: "fighter", label: "Fighter", data: fighter },
  { key: "multiclass", label: "Pal/Sorc multiclasse", data: multiclass },
];

/**
 * M1.1 shell: a data-driven, read-only sheet that renders any character from the
 * v2 schema. Sample switcher proves generality across classes; live editing and
 * real file load/save arrive in M1.2.
 */
export function App() {
  const { character, issues, migrated, ok, sourceName, loadRaw } = useCharacter();

  useEffect(() => {
    loadRaw(SAMPLES[0].data, SAMPLES[0].label);
  }, [loadRaw]);

  return (
    <div className="app">
      <nav className="toolbar">
        <span className="brand">D&amp;D Manager</span>
        <div className="samples">
          {SAMPLES.map((s) => (
            <button
              key={s.key}
              className={sourceName === s.label ? "sample is-active" : "sample"}
              onClick={() => loadRaw(s.data, s.label)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ValidationBadge issues={issues} migrated={migrated} ok={ok} />
      </nav>

      {character && <Sheet c={character} />}
    </div>
  );
}

function ValidationBadge({ issues, migrated, ok }: { issues: Issue[]; migrated: boolean; ok: boolean }) {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const label = !ok ? `✗ ${errors} errori` : warnings ? `⚠ ${warnings}` : "✓ valido";
  const tone = !ok ? "is-error" : warnings ? "is-warn" : "is-ok";
  return (
    <span className={`validation ${tone}`} title={issues.map((i) => `${i.path}: ${i.message}`).join("\n")}>
      {label}
      {migrated && <span className="migrated"> · migrato v1</span>}
    </span>
  );
}
