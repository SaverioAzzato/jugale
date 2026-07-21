import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { useCharacter } from "./state/store";
import { Sheet } from "./render/Sheet";
import { getVisibleTabs } from "./render/tabs";
import { useHorizontalSwipe } from "./render/useSwipeNav";
import {
  isFileAccessSupported,
  isDirectoryAccessSupported,
  openCharacterFile,
  openCharacterFolder,
  importJsonFile,
  importCharacterFolder,
  NO_CHARACTER_JSON,
  RECENT_PERMISSION_DENIED,
} from "./storage/provider";
import { isTauri, openCharacterFileTauri, openCharacterFolderTauri } from "./storage/tauriProvider";
import { isAndroid, openCharacterFileAndroid, openCharacterFolderAndroid } from "./storage/androidProvider";
import {
  recentsSupported,
  listRecents,
  recordRecent,
  removeRecent,
  clearRecents,
  reopenRecent,
  type RecentEntry,
} from "./storage/recents";
import { useT } from "./i18n/useI18n";
import { SettingsButton, SettingsPage } from "./ui/SettingsMenu";
import { PromptsButton, PromptsPage } from "./ui/PromptsPage";
import { RawJsonPage } from "./ui/RawJsonPage";
import { HelpButton, HelpPage } from "./ui/HelpPage";
import { DicePalette } from "./ui/DicePalette";
import { IssuesChip } from "./ui/IssuesChip";
import { DiceCanvas } from "./ui/dice/DiceCanvas";
import { Toasts } from "./ui/Toasts";
import { useToast } from "./ui/useToast";
import { EmptyState } from "./ui/EmptyState";
import { UpdateBanner } from "./update/UpdateBanner";
import { useUpdate } from "./update/useUpdate";
import { useSettings } from "./ui/useSettings";
import { toolbarCapacity } from "./ui/toolbarLayout";

type ToolbarActionId = "dice" | "edit" | "export" | "raw" | "prompts" | "settings";

const TOOLBAR_PRIORITY: ToolbarActionId[] = ["dice", "edit", "export", "raw", "prompts", "settings"];

function useToolbarCapacity(
  toolbarRef: RefObject<HTMLElement>,
  leftRef: RefObject<HTMLDivElement>,
  actionCount: number,
  fixedActionCount: number,
): number {
  const uiScale = useSettings((s) => s.uiScale);
  const [capacity, setCapacity] = useState(actionCount);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const left = leftRef.current;
    if (!toolbar || !left) return;
    const measure = () => {
      setCapacity(toolbarCapacity(toolbar.getBoundingClientRect().width, left.getBoundingClientRect().width, uiScale / 100, actionCount, fixedActionCount));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(toolbar);
    observer?.observe(left);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [actionCount, fixedActionCount, leftRef, toolbarRef, uiScale]);

  return actionCount > 0 ? Math.max(1, Math.min(capacity, actionCount)) : 0;
}

export function App() {
  const { character, sourceName, images, liveSync, dirty, saveError, readOnly, editMode, issues } = useCharacter(
    useShallow((s) => ({
      character: s.character,
      sourceName: s.sourceName,
      images: s.images,
      liveSync: s.liveSync,
      dirty: s.dirty,
      saveError: s.saveError,
      readOnly: s.readOnly,
      editMode: s.editMode,
      issues: s.issues,
    })),
  );
  const toggleEditMode = useCharacter((s) => s.toggleEditMode);
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
  const [swipeDirection, setSwipeDirection] = useState<-1 | 1 | null>(null);
  const [overlay, setOverlay] = useState<"settings" | "prompts" | "help" | "json" | null>(null);
  const overlayBackRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const toolbarLeftRef = useRef<HTMLDivElement>(null);
  const tabbarRef = useRef<HTMLElement>(null);

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
      if (e.key !== "Escape") return;
      // In the raw-JSON editor, Escape first dismisses an open completion popup / active snippet
      // (CodeMirror handles it but doesn't stop propagation) — only exit the editor otherwise.
      if (overlay === "json" && document.querySelector(".cm-tooltip-autocomplete, .cm-snippetField")) return;
      setOverlay(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.querySelector<HTMLElement>(`[data-overlay-trigger="${overlay}"]`)?.focus();
    };
  }, [overlay]);
  const tabs = character ? getVisibleTabs(character, images.length > 0, editMode) : [];
  const tab = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : (tabs[0]?.id ?? "gioco");

  const presentToolbarActions = useMemo<ToolbarActionId[]>(
    () => character ? TOOLBAR_PRIORITY : ["dice", "prompts", "settings"],
    [character],
  );
  const toolbarActionCapacity = useToolbarCapacity(
    toolbarRef,
    toolbarLeftRef,
    overlay ? 0 : presentToolbarActions.length,
    !overlay && !character ? 1 : 0, // Help stays visible on the welcome screen.
  );
  const visibleToolbarActions = useMemo(
    () => new Set(presentToolbarActions.slice(0, toolbarActionCapacity)),
    [presentToolbarActions, toolbarActionCapacity],
  );
  const overflowToolbarActions = useMemo(
    () => presentToolbarActions.filter((id) => !visibleToolbarActions.has(id)),
    [presentToolbarActions, visibleToolbarActions],
  );

  // Mobile: swipe left/right on the sheet to page between tabs (a text field or the JSON editor
  // keeps priority — see useHorizontalSwipe). Clamped at the ends.
  const swipeTabs = useHorizontalSwipe((dir) => {
    const idx = tabs.findIndex((tb) => tb.id === tab);
    const next = idx + dir;
    if (idx >= 0 && next >= 0 && next < tabs.length) {
      setSwipeDirection(dir);
      setActiveTab(tabs[next].id);
    }
  });

  // If the tab row overflows on mobile, keep the selected label in view after both a click and a
  // sheet swipe. Manipulating only scrollLeft avoids vertically moving the sticky app header.
  useEffect(() => {
    const bar = tabbarRef.current;
    const selected = document.getElementById(`tab-${tab}`);
    if (!bar || !selected) return;
    const left = selected.offsetLeft;
    const right = left + selected.offsetWidth;
    let target: number | null = null;
    if (left < bar.scrollLeft) target = left - 8;
    else if (right > bar.scrollLeft + bar.clientWidth) target = right - bar.clientWidth + 8;
    if (target === null) return;
    if (typeof bar.scrollTo === "function") bar.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    else bar.scrollLeft = Math.max(0, target);
  }, [overlay, tab]);

  // Check for a newer release once at startup (no-op on the web build, silent on failure).
  useEffect(() => {
    void useUpdate.getState().check();
  }, []);

  // Warn before leaving with unsaved in-memory edits (live-synced files save themselves).
  // Also covers a live sync that broke and fell back to read-only: liveSync flips false then.
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

  // Turn an open/read failure into a *specific* toast. The Android SAF path used to funnel every
  // error into "invalid JSON", which hid the real cause (a permission refusal, an unreadable URI)
  // behind a wrong message. Only a genuine JSON.parse failure is "invalid JSON" now; anything else
  // shows its actual message so a device-only failure is diagnosable.
  function reportOpenError(e: unknown) {
    const push = useToast.getState().push;
    if (e instanceof Error && e.message === NO_CHARACTER_JSON) return push("error", t("app.noCharacterJson"));
    if (e instanceof SyntaxError) return push("error", t("app.invalidJson"));
    const detail = e instanceof Error ? e.message : String(e);
    push("error", `${t("app.openFailed")}: ${detail}`);
  }

  async function handleOpen() {
    try {
      const result = isAndroid()
        ? await openCharacterFileAndroid()
        : isTauri()
          ? await openCharacterFileTauri()
          : await openCharacterFile();
      if (result) {
        connect(result.provider, result.raw, result.ref.name);
        void recordRecent(result.ref);
      }
    } catch (e) {
      reportOpenError(e);
    }
  }

  async function handleOpenFolderPicker() {
    try {
      const result = isAndroid()
        ? await openCharacterFolderAndroid()
        : isTauri()
          ? await openCharacterFolderTauri()
          : await openCharacterFolder();
      if (result) {
        connect(result.provider, result.raw, result.sourceName, result.images);
        void recordRecent(result.ref);
      }
    } catch (e) {
      reportOpenError(e);
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
      const raw = await importJsonFile(file);
      loadRaw(raw, file.name, [], true);
      // Read-only host: keep a snapshot so it can still appear in (and reopen from) Recents.
      void recordRecent({ platform: "snapshot", kind: "file", name: file.name, raw, images: [] });
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
      loadRaw(result.raw, result.sourceName, result.images, true);
      void recordRecent({
        platform: "snapshot",
        kind: "folder",
        name: result.sourceName,
        raw: result.raw,
        images: result.imageBlobs,
      });
    } catch (err) {
      const key = err instanceof Error && err.message === NO_CHARACTER_JSON ? "app.noCharacterJson" : "app.invalidJson";
      useToast.getState().push("error", t(key));
    } finally {
      e.target.value = "";
    }
  }

  // ---- Recents (welcome screen): last-opened characters, reopenable in one click ----
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const refreshRecents = useCallback(() => {
    if (recentsSupported()) listRecents().then(setRecents).catch(() => setRecents([]));
  }, []);
  useEffect(() => {
    if (!character) refreshRecents(); // (re)load whenever we're on the welcome screen
  }, [character, refreshRecents]);

  async function handleReopenRecent(entry: RecentEntry) {
    try {
      const result = await reopenRecent(entry);
      if (result.mode === "live") {
        connect(result.provider, result.raw, result.sourceName, result.images);
      } else {
        loadRaw(result.raw, result.sourceName, result.images, true); // snapshot → read-only
      }
      void recordRecent(entry); // bump it to the top
    } catch (e) {
      if (e instanceof Error && e.message === RECENT_PERMISSION_DENIED) {
        useToast.getState().push("error", t("recents.permissionDenied"));
        return; // keep the entry — the file is fine, the user just declined access
      }
      useToast.getState().push("error", t("recents.reopenFailed"));
      await removeRecent(entry.key); // stale (moved/deleted) — prune it from the list
      refreshRecents();
    }
  }

  async function handleClearRecents() {
    await clearRecents();
    refreshRecents();
  }

  return (
    <div className={overlay === "json" ? "app app-rawjson" : "app"}>
      <header className="appbar">
        <nav className="toolbar" ref={toolbarRef}>
          <div className="toolbar-left" ref={toolbarLeftRef}>
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
                {t(
                  overlay === "settings"
                    ? "settings.title"
                    : overlay === "prompts"
                      ? "prompts.title"
                      : overlay === "json"
                        ? "rawjson.title"
                        : "help.title",
                )}
              </span>
            )}
          </div>
          <div className="toolbar-right">
            {overlay === "json" && character && (
              <RawJsonButton active onClick={() => setOverlay(null)} label={t("code.toggle")} />
            )}
            {!overlay && (
              <>
                {character && visibleToolbarActions.has("export") && (
                  <button
                    className="btn btn-icon"
                    onClick={exportCharacter}
                    title={t("app.export")}
                    aria-label={t("app.export")}
                  >
                    <DownloadIcon />
                  </button>
                )}
                {character && visibleToolbarActions.has("edit") && (
                  <button
                    className={editMode ? "btn btn-icon edit-toggle-btn is-on" : "btn btn-icon edit-toggle-btn"}
                    onClick={toggleEditMode}
                    aria-pressed={editMode}
                    title={t("edit.toggle")}
                    aria-label={t("edit.toggle")}
                  >
                    <PencilIcon />
                  </button>
                )}
                {!character && <HelpButton onClick={() => setOverlay("help")} />}
                {character && visibleToolbarActions.has("raw") && (
                  <RawJsonButton active={false} onClick={() => setOverlay("json")} label={t("code.toggle")} />
                )}
                {visibleToolbarActions.has("dice") && <DicePalette />}
                {visibleToolbarActions.has("prompts") && <PromptsButton onClick={() => setOverlay("prompts")} />}
                {visibleToolbarActions.has("settings") && <SettingsButton onClick={() => setOverlay("settings")} />}
                {overflowToolbarActions.length > 0 && (
                  <ToolbarOverflow
                    actions={overflowToolbarActions}
                    onExport={exportCharacter}
                    onEdit={toggleEditMode}
                    onRaw={() => setOverlay("json")}
                    onPrompts={() => setOverlay("prompts")}
                    onSettings={() => setOverlay("settings")}
                  />
                )}
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
          <nav className="tabbar" ref={tabbarRef} role="tablist" aria-label="Sections">
            {tabs.map((tabDef) => (
              <button
                key={tabDef.id}
                id={`tab-${tabDef.id}`}
                role="tab"
                aria-selected={tab === tabDef.id}
                aria-controls={`tabpanel-${tabDef.id}`}
                className={tab === tabDef.id ? "tab is-active" : "tab"}
                onClick={() => {
                  setSwipeDirection(null);
                  setActiveTab(tabDef.id);
                }}
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
      ) : overlay === "help" ? (
        <HelpPage />
      ) : overlay === "json" ? (
        <RawJsonPage />
      ) : character ? (
        <div
          key={tab}
          className={
            swipeDirection === null
              ? "sheet-swipe"
              : `sheet-swipe sheet-swipe-${swipeDirection > 0 ? "from-right" : "from-left"}`
          }
          onTouchStart={swipeTabs.onTouchStart}
          onTouchEnd={swipeTabs.onTouchEnd}
        >
          <Sheet c={character} tab={tab} />
        </div>
      ) : (
        <EmptyState
          onOpenJson={handleOpenJson}
          onOpenFolder={handleOpenFolder}
          onSample={(d, l, imgs) => loadRaw(d, l, imgs)}
          recents={recents}
          onReopenRecent={handleReopenRecent}
          onClearRecents={handleClearRecents}
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
            {readOnly ? (
              <>
                <span
                  className="statusbar-readonly"
                  title={saveError ? `${t("status.saveError")}: ${saveError}` : t("status.readOnlyHint")}
                >
                  {t("status.readOnly")}
                </span>
                <button type="button" className="statusbar-export-link" onClick={exportCharacter}>
                  {t("status.exportToSave")}
                </button>
              </>
            ) : (
              <span className={liveSync ? "statusbar-sync is-live" : "statusbar-sync"}>
                {liveSync ? t("status.live") : dirty ? t("status.unsaved") : t("status.memory")}
              </span>
            )}
          </span>
          <IssuesChip issues={issues} />
        </footer>
      )}

      <UpdateBanner />
      <DiceCanvas />
      <Toasts />
    </div>
  );
}

/** Pencil glyph for the Edit-mode toggle (Lucide "pencil"). */
function PencilIcon() {
  return (
    <svg
      className="settings-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

interface ToolbarOverflowProps {
  actions: ToolbarActionId[];
  onExport: () => void;
  onEdit: () => void;
  onRaw: () => void;
  onPrompts: () => void;
  onSettings: () => void;
}

/** Compact home for lower-priority toolbar actions when the viewport cannot hold every icon. */
function ToolbarOverflow({ actions, onExport, onEdit, onRaw, onPrompts, onSettings }: ToolbarOverflowProps) {
  const t = useT();
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOutside = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) ref.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const definitions: Partial<Record<ToolbarActionId, { label: string; run: () => void; trigger?: string }>> = {
    edit: { label: t("edit.toggle"), run: onEdit },
    export: { label: t("app.export"), run: onExport },
    raw: { label: t("code.toggle"), run: onRaw, trigger: "json" },
    prompts: { label: t("prompts.title"), run: onPrompts, trigger: "prompts" },
    settings: { label: t("settings.title"), run: onSettings, trigger: "settings" },
  };

  return (
    <details className="toolbar-overflow" ref={ref}>
      <summary
        className="btn btn-icon toolbar-more"
        role="button"
        aria-haspopup="menu"
        aria-label={t("toolbar.more")}
        title={t("toolbar.more")}
      >
        <span aria-hidden="true">•••</span>
      </summary>
      <div className="toolbar-overflow-menu" role="menu">
        {actions.map((id) => {
          const action = definitions[id];
          if (!action) return null;
          return (
            <button
              key={id}
              type="button"
              role="menuitem"
              data-overlay-trigger={action.trigger}
              onClick={() => {
                if (ref.current) ref.current.open = false;
                action.run();
              }}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </details>
  );
}

/** `</>` glyph for the raw-JSON toggle. */
function CodeIcon() {
  return (
    <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M8.5 8 4.5 12l4 4 M15.5 8 19.5 12l-4 4 M13.5 5l-3 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Down-arrow-into-tray glyph for the Export action. */
function DownloadIcon() {
  return (
    <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 4v9 M8.5 10.5 12 14l3.5-3.5 M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The raw-JSON toggle button (shown both in the sheet and, highlighted, in the JSON view). */
function RawJsonButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={active ? "btn btn-icon code-toggle-btn is-on" : "btn btn-icon code-toggle-btn"}
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
    >
      <CodeIcon />
    </button>
  );
}
