import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCharacter } from "./state/store";
import { Sheet } from "./render/Sheet";
import { getVisibleTabs } from "./render/tabs";
import {
  isFileAccessSupported,
  openCharacterFile,
  importJsonFile,
} from "./storage/provider";
import { useT, type TFn } from "./i18n/useI18n";
import { SettingsButton, SettingsPage } from "./ui/SettingsMenu";
import { Toasts } from "./ui/Toasts";
import { useToast } from "./ui/useToast";
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
  { key: "multiclass", label: "Multiclass", data: multiclass },
];

export function App() {
  const { character, sourceName, liveSync, dirty, saveError } = useCharacter(
    useShallow((s) => ({
      character: s.character,
      sourceName: s.sourceName,
      liveSync: s.liveSync,
      dirty: s.dirty,
      saveError: s.saveError,
    })),
  );
  const loadRaw = useCharacter((s) => s.loadRaw);
  const connect = useCharacter((s) => s.connect);
  const exportCharacter = useCharacter((s) => s.exportCharacter);
  const clear = useCharacter((s) => s.clear);
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const fileAccessSupported = isFileAccessSupported();

  const [activeTab, setActiveTab] = useState("gioco");
  const [showSettings, setShowSettings] = useState(false);
  const tabs = character ? getVisibleTabs(character) : [];
  const tab = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : (tabs[0]?.id ?? "gioco");

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

  function handleBackToHome() {
    if (dirty && !liveSync && !window.confirm(t("app.confirmLeave"))) return;
    clear();
  }

  function handleOpenJson() {
    if (fileAccessSupported) {
      void handleOpen();
      return;
    }
    fileInput.current?.click();
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      loadRaw(await importJsonFile(file), file.name);
    } catch {
      useToast.getState().push("error", t("app.invalidJson"));
    }
  }

  return (
    <div className="app">
      <header className="appbar">
        <nav className="toolbar">
          <div className="toolbar-left">
            {showSettings ? (
              <button
                className="btn btn-back"
                onClick={() => setShowSettings(false)}
                title={t("app.back")}
                aria-label={t("app.back")}
              >
                <svg className="back-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M15.5 4.5 8 12l7.5 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : (
              character && (
                <button
                  className="btn btn-back"
                  onClick={handleBackToHome}
                  title={t("app.backTitle")}
                  aria-label={t("app.back")}
                >
                  <svg
                    className="back-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M15.5 4.5 8 12l7.5 7.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )
            )}
            {showSettings && <span className="toolbar-title">{t("settings.title")}</span>}
          </div>
          <div className="toolbar-right">
            {!showSettings && (
              <>
                {character && (
                  <button className="btn" onClick={exportCharacter} title={t("app.export")}>
                    {t("app.export")}
                  </button>
                )}
                <SettingsButton onClick={() => setShowSettings(true)} />
              </>
            )}
          </div>
        </nav>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImportFile}
        />

        {!showSettings && character && tabs.length > 0 && (
          <nav className="tabbar" role="tablist" aria-label="Sections">
            {tabs.map((tabDef) => (
              <button
                key={tabDef.id}
                role="tab"
                aria-selected={tab === tabDef.id}
                className={tab === tabDef.id ? "tab is-active" : "tab"}
                onClick={() => setActiveTab(tabDef.id)}
              >
                {t(tabDef.labelKey)}
              </button>
            ))}
          </nav>
        )}
      </header>

      {showSettings ? (
        <SettingsPage />
      ) : character ? (
        <Sheet c={character} tab={tab} />
      ) : (
        <EmptyState onOpenJson={handleOpenJson} onSample={(d, l) => loadRaw(d, l)} t={t} />
      )}

      {!showSettings && character && (
        <footer className="statusbar" role="status" aria-live="polite">
          <span className="statusbar-file">
            {t("status.file")}: {sourceName || t("status.unnamed")}
          </span>
          <span className="statusbar-sep" aria-hidden>
            •
          </span>
          <span className="statusbar-sync">
            {liveSync ? t("status.live") : dirty ? t("status.unsaved") : t("status.memory")}
          </span>
          {saveError && (
            <>
              <span className="statusbar-sep" aria-hidden>
                •
              </span>
              <span className="statusbar-error">
                {t("status.saveError")}: {saveError}
              </span>
            </>
          )}
        </footer>
      )}

      <Toasts />
    </div>
  );
}

function EmptyState({
  onOpenJson,
  onSample,
  t,
}: {
  onOpenJson: () => void;
  onSample: (data: unknown, label: string) => void;
  t: TFn;
}) {
  return (
    <div className="empty-state">
      <div className="empty-card">
        <h1>{t("empty.title")}</h1>
        <p className="muted">{t("empty.body")}</p>
        <div className="empty-actions">
          <button className="btn btn-primary" onClick={onOpenJson}>
            {t("app.open")}
          </button>
        </div>
        <div className="empty-samples">
          <span className="muted empty-samples-label">{t("empty.tryExample")}</span>
          {SAMPLES.map((s) => (
            <button
              key={s.key}
              className="sample sample-grid-item"
              onClick={() => onSample(s.data, s.label)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
