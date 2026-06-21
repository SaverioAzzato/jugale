import { useMemo } from "react";
import { loadCharacter, proficiencyBonus, totalLevel, abilityModifierFor } from "./schema";
import exampleRaw from "../characters/example-warlock/character.json";

/**
 * M0 shell. This is intentionally minimal: its job is to prove the engine
 * end-to-end (load → migrate → validate → derive) on a real character.
 * The data-driven sheet UI arrives in M1/M2.
 */
export function App() {
  const result = useMemo(() => loadCharacter(exampleRaw), []);
  const { character, issues, migrated, ok } = result;

  return (
    <main style={shell}>
      <header>
        <p style={eyebrow}>D&amp;D, but Digital — M0 engine preview</p>
        <h1 style={{ margin: "4px 0 0" }}>{character.meta.name}</h1>
        <p style={{ color: "#9aa", margin: "4px 0 0" }}>{character.meta.summary}</p>
      </header>

      <section style={card}>
        <h2 style={h2}>Derived</h2>
        <dl style={grid}>
          <Stat label="Livello totale" value={totalLevel(character)} />
          <Stat label="Bonus competenza" value={`+${proficiencyBonus(character)}`} />
          <Stat label="Mod. CAR" value={fmt(abilityModifierFor(character, "cha"))} />
          <Stat label="Classi" value={character.classes.map((c) => `${c.name} ${c.level}`).join(" / ") || "—"} />
        </dl>
      </section>

      <section style={card}>
        <h2 style={h2}>Risorse</h2>
        {character.resources.length === 0 && <p style={{ color: "#9aa" }}>Nessuna risorsa.</p>}
        {character.resources.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span>{r.label}</span>
            <span style={{ color: "#9aa" }}>
              {r.current}/{r.max} · reset: {r.resetOn}
            </span>
          </div>
        ))}
      </section>

      <section style={card}>
        <h2 style={h2}>
          Validazione {ok ? "✓" : "✗"} {migrated && <span style={{ color: "#e0a44c" }}>(migrato da v1)</span>}
        </h2>
        {issues.length === 0 ? (
          <p style={{ color: "#5fbf7f" }}>Nessun problema rilevato.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {issues.map((i, idx) => (
              <li key={idx} style={{ color: i.severity === "error" ? "#e06c6c" : "#e0a44c" }}>
                <code>{i.path || "(root)"}</code>: {i.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt style={{ color: "#9aa", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{value}</dd>
    </div>
  );
}

const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

const shell: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "32px 20px 64px",
  fontFamily: "system-ui, sans-serif",
};
const card: React.CSSProperties = {
  marginTop: 20,
  padding: "16px 20px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};
const h2: React.CSSProperties = { margin: "0 0 10px", fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: "#cbd" };
const eyebrow: React.CSSProperties = { margin: 0, color: "#7a7af0", fontSize: 12, textTransform: "uppercase", letterSpacing: 2 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, margin: 0 };
