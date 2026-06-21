import { useEffect, useRef, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCharacter } from "./state/store";
import { Sheet } from "./render/Sheet";
import type { Issue } from "./schema";
import { isFileAccessSupported, openCharacterFile, importJsonFile } from "./storage/provider";
import warlock from "../characters/example-warlock/character.json";
import fighter from "../characters/example-fighter/character.json";
import multiclass from "../characters/example-multiclass/character.json";

const SAMPLES = [
  { key: "warlock", label: "Warlock (Tomo)", data: warlock },
  { key: "fighter", label: "Fighter", data: fighter },
  { key: "multiclass", label: "Pal/Sorc multiclasse", data: multiclass },
];

export function App() {
  const { character, issues, migrated, ok, sourceName, liveSync, dirty, saveError } = useCharacter(
    useShallow((s) => ({
      character: s.character,
      issues: s.issues,
      migrated: s.migrated,
      ok: s.ok,
      sourceName: s.sourceName,
      liveSync: s.liveSync,
      dirty: s.dirty,
      saveError: s.saveError,
    })),
  );
  const loadRaw = useCharacter((s) => s.loadRaw);
  const connect = useCharacter((s) => s.connect);
  const exportCharacter = useCharacter((s) => s.exportCharacter);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!useCharacter.getState().character) loadRaw(SAMPLES[0].data, SAMPLES[0].label);
  }, [loadRaw]);

  // Warn before leaving with unsaved in-memory edits (live-synced files save themselves).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty && !liveSync) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, liveSync]);

  async function handleOpen() {
    const result = await openCharacterFile();
    if (result) connect(result.provider, result.raw, "file");
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      loadRaw(await importJsonFile(file), file.name);
    } catch {
      alert("File JSON non valido.");
    }
  }

  return (
    <div className="app">
      <nav className="toolbar">
        <span className="brand">D&amp;D Manager</span>

        <div className="toolbar-actions">
          {isFileAccessSupported() && (
            <button className="btn" onClick={handleOpen} title="Apri un character.json con sincronizzazione dal vivo">
              Apri file
            </button>
          )}
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Importa
          </button>
          <button className="btn" onClick={exportCharacter} disabled={!character}>
            Esporta
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
        </div>

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

        <SyncStatus liveSync={liveSync} dirty={dirty} saveError={saveError} sourceName={sourceName} />
        <ValidationBadge issues={issues} migrated={migrated} ok={ok} />
      </nav>

      {character && <Sheet c={character} />}
    </div>
  );
}

function SyncStatus({
  liveSync,
  dirty,
  saveError,
  sourceName,
}: {
  liveSync: boolean;
  dirty: boolean;
  saveError: string | null;
  sourceName: string;
}) {
  if (saveError) return <span className="sync is-error" title={saveError}>⚠ errore salvataggio</span>;
  if (liveSync) return <span className="sync is-live">● file in sync{dirty ? "…" : ""}</span>;
  if (dirty) return <span className="sync is-dirty" title="Esporta per non perdere le modifiche">● non salvato</span>;
  return <span className="sync is-mem">{sourceName ? "in memoria" : ""}</span>;
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
