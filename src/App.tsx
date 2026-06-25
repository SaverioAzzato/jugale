import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCharacter } from "./state/store";
import { Sheet } from "./render/Sheet";
import { getVisibleTabs } from "./render/tabs";
import {
  isFileAccessSupported,
  isDirectoryAccessSupported,
  openCharacterFile,
  openCharacterFolder,
  importJsonFile,
  importCharacterFolder,
  NO_CHARACTER_JSON,
  type GalleryImage,
} from "./storage/provider";
import { isTauri, openCharacterFileTauri, openCharacterFolderTauri } from "./storage/tauriProvider";
import { useT, type TFn } from "./i18n/useI18n";
import { SettingsButton, SettingsPage } from "./ui/SettingsMenu";
import { PromptsButton, PromptsPage } from "./ui/PromptsPage";
import { DicePalette } from "./ui/DicePalette";
import { IssuesChip } from "./ui/IssuesChip";
import { DiceCanvas } from "./ui/dice/DiceCanvas";
import { Toasts } from "./ui/Toasts";
import { useToast } from "./ui/useToast";
import warlock from "../characters/example-warlock/character.json";
import fighter from "../characters/example-fighter/character.json";
import cleric from "../characters/example-cleric/character.json";
import sorcerer from "../characters/example-sorcerer/character.json";
import multiclass from "../characters/example-multiclass/character.json";

// Sample images bundled at build time so the example portraits/gallery work with no real folder.
const imageModules = import.meta.glob("../characters/*/images/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** Images for a sample's folder, alphabetical by filename — same ordering the folder loaders use. */
function sampleImages(folder: string): GalleryImage[] {
  const prefix = `../characters/${folder}/images/`;
  return Object.entries(imageModules)
    .filter(([path]) => path.startsWith(prefix) && IMAGE_RE.test(path))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, url]) => ({ name: `images/${path.slice(prefix.length)}`, url }));
}

const SAMPLES = [
  { key: "warlock", label: "Warlock", folder: "example-warlock", data: warlock },
  { key: "fighter", label: "Fighter", folder: "example-fighter", data: fighter },
  { key: "cleric", label: "Cleric", folder: "example-cleric", data: cleric },
  { key: "sorcerer", label: "Sorcerer", folder: "example-sorcerer", data: sorcerer },
  { key: "multiclass", label: "Multiclass", folder: "example-multiclass", data: multiclass },
];

export function App() {
  const { character, sourceName, images, liveSync, dirty, saveError, issues } = useCharacter(
    useShallow((s) => ({
      character: s.character,
      sourceName: s.sourceName,
      images: s.images,
      liveSync: s.liveSync,
      dirty: s.dirty,
      saveError: s.saveError,
      issues: s.issues,
    })),
  );
  const loadRaw = useCharacter((s) => s.loadRaw);
  const connect = useCharacter((s) => s.connect);
  const exportCharacter = useCharacter((s) => s.exportCharacter);
  const clear = useCharacter((s) => s.clear);
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const fileAccessSupported = isTauri() || isFileAccessSupported();

  // webkitdirectory isn't in React's typed attributes; set it imperatively.
  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);

  const [activeTab, setActiveTab] = useState("gioco");
  const [overlay, setOverlay] = useState<"settings" | "prompts" | null>(null);
  const overlayBackRef = useRef<HTMLButtonElement>(null);

  // Settings/Prompts are full-page overlays, not floating popovers — nothing else behind
  // them is reachable (the toolbar's other buttons and the footer all unmount while one is
  // open), so a full Tab-trap isn't needed. Just move focus in, let Escape close, and give
  // it back to whatever opened the overlay once it's gone. The triggering button (Settings/
  // Prompts) unmounts while the overlay is open and a structurally-new one remounts once it
  // closes — a saved DOM-node ref would be stale by then, so this re-queries by
  // [data-overlay-trigger] for a live node instead of holding onto one.
  useEffect(() => {
    if (!overlay) return;
    overlayBackRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlay(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.querySelector<HTMLElement>(`[data-overlay-trigger="${overlay}"]`)?.focus();
    };
  }, [overlay]);
  const tabs = character ? getVisibleTabs(character, images.length > 0) : [];
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
    const result = isTauri() ? await openCharacterFileTauri() : await openCharacterFile();
    if (result) connect(result.provider, result.raw, "file");
  }

  async function handleOpenFolderPicker() {
    try {
      const result = isTauri() ? await openCharacterFolderTauri() : await openCharacterFolder();
      if (result) connect(result.provider, result.raw, result.sourceName, result.images);
    } catch (e) {
      const key = e instanceof Error && e.message === NO_CHARACTER_JSON ? "app.noCharacterJson" : "app.invalidJson";
      useToast.getState().push("error", t(key));
    }
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

  function handleOpenFolder() {
    if (isTauri() || isDirectoryAccessSupported()) {
      void handleOpenFolderPicker();
      return;
    }
    folderInput.current?.click();
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

  async function handleImportFolder(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) {
      e.target.value = "";
      return;
    }
    try {
      const result = await importCharacterFolder(files);
      loadRaw(result.raw, result.sourceName, result.images);
    } catch (err) {
      const key = err instanceof Error && err.message === NO_CHARACTER_JSON ? "app.noCharacterJson" : "app.invalidJson";
      useToast.getState().push("error", t(key));
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="app">
      <header className="appbar">
        <nav className="toolbar">
          <div className="toolbar-left">
            {overlay ? (
              <button
                ref={overlayBackRef}
                className="btn btn-back"
                onClick={() => setOverlay(null)}
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
            {overlay && (
              <span className="toolbar-title">
                {t(overlay === "settings" ? "settings.title" : "prompts.title")}
              </span>
            )}
          </div>
          <div className="toolbar-right">
            {!overlay && (
              <>
                {character && (
                  <button className="btn" onClick={exportCharacter} title={t("app.export")}>
                    {t("app.export")}
                  </button>
                )}
                <DicePalette />
                <PromptsButton onClick={() => setOverlay("prompts")} />
                <SettingsButton onClick={() => setOverlay("settings")} />
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
        <input ref={folderInput} type="file" hidden multiple onChange={handleImportFolder} />

        {!overlay && character && tabs.length > 0 && (
          <nav className="tabbar" role="tablist" aria-label="Sections">
            {tabs.map((tabDef) => (
              <button
                key={tabDef.id}
                id={`tab-${tabDef.id}`}
                role="tab"
                aria-selected={tab === tabDef.id}
                aria-controls={`tabpanel-${tabDef.id}`}
                className={tab === tabDef.id ? "tab is-active" : "tab"}
                onClick={() => setActiveTab(tabDef.id)}
              >
                {t(tabDef.labelKey)}
              </button>
            ))}
          </nav>
        )}
      </header>

      {overlay === "settings" ? (
        <SettingsPage />
      ) : overlay === "prompts" ? (
        <PromptsPage />
      ) : character ? (
        <Sheet c={character} tab={tab} />
      ) : (
        <EmptyState
          onOpenJson={handleOpenJson}
          onOpenFolder={handleOpenFolder}
          onSample={(d, l, imgs) => loadRaw(d, l, imgs)}
          t={t}
        />
      )}

      {!overlay && character && (
        <footer className="statusbar">
          <span className="statusbar-status" role="status" aria-live="polite">
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
          </span>
          <IssuesChip issues={issues} />
        </footer>
      )}

      <DiceCanvas />
      <Toasts />
    </div>
  );
}

function EmptyState({
  onOpenJson,
  onOpenFolder,
  onSample,
  t,
}: {
  onOpenJson: () => void;
  onOpenFolder: () => void;
  onSample: (data: unknown, label: string, images: GalleryImage[]) => void;
  t: TFn;
}) {
  return (
    <div className="empty-state">
      <div className="empty-brand">:JUGALE</div>
      <div className="empty-card">
        <h1>{t("empty.title")}</h1>
        <p className="muted">{t("empty.body")}</p>
        <div className="empty-actions">
          <button className="btn btn-primary" onClick={onOpenFolder}>
            {t("app.openFolder")}
          </button>
          <button className="btn" onClick={onOpenJson}>
            {t("app.open")}
          </button>
        </div>
        <div className="empty-samples">
          <span className="muted empty-samples-label">{t("empty.tryExample")}</span>
          {SAMPLES.map((s) => (
            <button
              key={s.key}
              className="sample sample-grid-item"
              onClick={() => onSample(s.data, s.label, sampleImages(s.folder))}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
