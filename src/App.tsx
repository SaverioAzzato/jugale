import { useEffect, useRef, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCharacter } from "./state/store";
import { Sheet } from "./render/Sheet";
import type { Issue } from "./schema";
import { isFileAccessSupported, openCharacterFile, importJsonFile } from "./storage/provider";
import { ThemeSwitcher } from "./theme/ThemeSwitcher";
import warlock from "../characters/example-warlock/character.json";
import fighter from "../characters/example-fighter/character.json";
import cleric from "../characters/example-cleric/character.json";
import sorcerer from "../characters/example-sorcerer/character.json";
import multiclass from "../characters/example-multiclass/character.json";

const SAMPLES = [
  { key: "warlock", label: "Warlock", data: warlock },
  { key: "fighter", label: "Fighter", data: fighter },
  { key: "cleric", label: "Cleric", data: cleric },
  { key: "sorcerer", label: "Sorcerer", data: sorcerer },
  { key: "multiclass", label: "Multiclasse", data: multiclass },
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

        <div className="toolbar-file">
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

        <div className="toolbar-right">
          {character && <span className="toolbar-name">{sourceName || character.meta.name}</span>}
          {character && <SyncStatus liveSync={liveSync} dirty={dirty} saveError={saveError} />}
          {character && <ValidationBadge issues={issues} migrated={migrated} ok={ok} />}
          <ThemeSwitcher />
        </div>
      </nav>

      {character ? (
        <Sheet c={character} />
      ) : (
        <EmptyState onOpen={handleOpen} onImport={() => fileInput.current?.click()} onSample={(d, l) => loadRaw(d, l)} />
      )}
    </div>
  );
}

function EmptyState({
  onOpen,
  onImport,
  onSample,
}: {
  onOpen: () => void;
  onImport: () => void;
  onSample: (data: unknown, label: string) => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-card">
        <h1>Il tuo personaggio, sempre tuo.</h1>
        <p className="muted">
          Apri il tuo <code>character.json</code> per giocarci con salvataggio dal vivo, oppure importane una copia.
        </p>
        <div className="empty-actions">
          {isFileAccessSupported() && (
            <button className="btn btn-primary" onClick={onOpen}>
              Apri file
            </button>
          )}
          <button className="btn" onClick={onImport}>
            Importa JSON
          </button>
        </div>
        <div className="empty-samples">
          <span className="muted">oppure prova un esempio:</span>
          {SAMPLES.map((s) => (
            <button key={s.key} className="sample" onClick={() => onSample(s.data, s.label)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SyncStatus({ liveSync, dirty, saveError }: { liveSync: boolean; dirty: boolean; saveError: string | null }) {
  if (saveError) return <span className="sync is-error" title={saveError}>⚠ errore salvataggio</span>;
  if (liveSync) return <span className="sync is-live">● file in sync{dirty ? "…" : ""}</span>;
  if (dirty) return <span className="sync is-dirty" title="Esporta per non perdere le modifiche">● non salvato</span>;
  return <span className="sync is-mem">in memoria</span>;
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
