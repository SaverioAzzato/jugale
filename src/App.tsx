import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useCharacter } from "./characterStore";
import { Sheet } from "./render/Sheet";
import { getVisibleTabs } from "./render/tabVisibility";
import { useHorizontalSwipe } from "./render/useSwipeNav";
import { useT } from "./i18n/useI18n";
import { DicePalette } from "./ui/DicePalette";
import { IssuesChip } from "./ui/IssuesChip";
import { DiceCanvas } from "./ui/dice/DiceCanvas";
import { Toasts } from "./ui/Toasts";
import { EmptyState } from "./ui/EmptyState";
import { UpdateBanner } from "./update/UpdateBanner";
import { useUpdate } from "./update/useUpdate";
import { useSettings } from "./ui/useSettings";
import { SaveVersionDialog } from "./ui/VersionDialog";
import { IncomingCharacterDialog } from "./ui/IncomingCharacterDialog";
import { AppToolbar } from "./ui/AppToolbar";
import { useOverlayNavigation } from "./app/useOverlayNavigation";
import { useCharacterOpening } from "./app/useCharacterOpening";
import { useRecents } from "./app/useRecents";
import { useIncomingCharacterShare } from "./app/useIncomingCharacterShare";

const SettingsPage = lazy(() => import("./ui/SettingsMenu").then((module) => ({ default: module.SettingsPage })));
const PromptsPage = lazy(() => import("./ui/PromptsPage").then((module) => ({ default: module.PromptsPage })));
const RawJsonPage = lazy(() => import("./ui/RawJsonPage").then((module) => ({ default: module.RawJsonPage })));
const HelpPage = lazy(() => import("./ui/HelpPage").then((module) => ({ default: module.HelpPage })));
const VersionsPage = lazy(() => import("./ui/VersionsPage").then((module) => ({ default: module.VersionsPage })));

export function App() {
  const { character, validation, sourceName, images, liveSync, dirty, saveError, readOnly, editMode, issues, versionsAvailable, versionBusy } = useCharacter(
    useShallow((s) => ({
      character: s.character,
      validation: s.validation,
      sourceName: s.sourceName,
      images: s.images,
      liveSync: s.liveSync,
      dirty: s.dirty,
      saveError: s.saveError,
      readOnly: s.readOnly,
      editMode: s.editMode,
      issues: s.issues,
      versionsAvailable: Boolean(s.provider?.versions),
      versionBusy: s.versionBusy,
    })),
  );
  const toggleEditMode = useCharacter((s) => s.toggleEditMode);
  const exportCharacter = useCharacter((s) => s.exportCharacter);
  const createVersion = useCharacter((s) => s.createVersion);
  const clear = useCharacter((s) => s.clear);
  const t = useT();
  const versionHistory = useSettings((s) => s.versionHistory);
  const {
    fileInputRef,
    folderInputRef,
    handleOpenJson,
    handleOpenFolder,
    handleImportFile,
    handleImportFolder,
    reportOpenError,
  } = useCharacterOpening();

  const [activeTab, setActiveTab] = useState("gioco");
  const [swipeDirection, setSwipeDirection] = useState<-1 | 1 | null>(null);
  const tabbarRef = useRef<HTMLElement>(null);
  const diceButtonPosition = useSettings((s) => s.diceButtonPosition);
  const characterOpen = character !== null;
  const {
    overlay,
    setOverlay,
    saveVersionOpen,
    setSaveVersionOpen,
    overlayBackRef,
    handleUiBack,
  } = useOverlayNavigation({
    characterOpen,
    dirty,
    liveSync,
    versionBusy,
    clearCharacter: clear,
    confirmLeave: () => window.confirm(t("app.confirmLeave")),
  });
  const {
    recents,
    reopenRecent: handleReopenRecent,
    clearRecents: handleClearRecents,
    removeRecent: handleRemoveRecent,
  } = useRecents(characterOpen);
  const {
    incoming: incomingCharacter,
    targetName: incomingTargetName,
    nameMismatch: incomingNameMismatch,
    chooseTarget: chooseIncomingTarget,
    apply: applyIncomingCharacter,
    cancel: cancelIncomingCharacter,
  } = useIncomingCharacterShare(character?.meta.name ?? null, reportOpenError);
  const tabs = character ? getVisibleTabs(character, images.length > 0, editMode) : [];
  const tab = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : (tabs[0]?.id ?? "gioco");

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

  return (
    <div className={overlay === "json" ? "app app-rawjson" : "app"}>
      <header className="appbar">
        <AppToolbar
          overlay={overlay}
          overlayBackRef={overlayBackRef}
          characterOpen={characterOpen}
          editMode={editMode}
          versionHistory={versionHistory}
          versionsAvailable={versionsAvailable}
          versionBusy={versionBusy}
          readOnly={readOnly}
          liveSync={liveSync}
          diceButtonPosition={diceButtonPosition}
          onBack={handleUiBack}
          onExport={exportCharacter}
          onEdit={toggleEditMode}
          onVersion={() => setSaveVersionOpen(true)}
          onOverlay={setOverlay}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleImportFile}
        />
        <input ref={folderInputRef} type="file" hidden multiple onChange={handleImportFolder} />

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

      {overlay ? (
        <Suspense fallback={null}>
          {overlay === "settings" ? (
            <SettingsPage />
          ) : overlay === "prompts" ? (
            <PromptsPage />
          ) : overlay === "help" ? (
            <HelpPage />
          ) : overlay === "versions" ? (
            <VersionsPage onRestored={() => setOverlay(null)} />
          ) : (
            <RawJsonPage />
          )}
        </Suspense>
      ) : character ? (
        <div
          key={tab}
          className={
            swipeDirection === null
              ? "sheet-swipe"
              : `sheet-swipe sheet-swipe-${swipeDirection > 0 ? "from-right" : "from-left"}`
          }
          onTouchStart={swipeTabs.onTouchStart}
          onTouchMove={swipeTabs.onTouchMove}
          onTouchEnd={swipeTabs.onTouchEnd}
          onTouchCancel={swipeTabs.onTouchCancel}
        >
          <Sheet c={character} tab={tab} />
        </div>
      ) : (
        <EmptyState
          onOpenJson={handleOpenJson}
          onOpenFolder={handleOpenFolder}
          onSample={(d, l, imgs) => useCharacter.getState().loadRaw(d, l, imgs)}
          recents={recents}
          onReopenRecent={handleReopenRecent}
          onRemoveRecent={handleRemoveRecent}
          onClearRecents={handleClearRecents}
          onPrompts={() => setOverlay("prompts")}
          onHelp={() => setOverlay("help")}
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
                {validation?.kind === "schema-invalid"
                  ? t("status.invalidDraft")
                  : liveSync
                    ? t("status.live")
                    : dirty
                      ? t("status.unsaved")
                      : t("status.memory")}
              </span>
            )}
          </span>
          <IssuesChip issues={issues} />
        </footer>
      )}

      <UpdateBanner />
      {diceButtonPosition !== "toolbar" && <DicePalette placement={diceButtonPosition} />}
      <DiceCanvas layoutKey={`${overlay ?? "sheet"}:${character ? "character" : "empty"}:${readOnly}`} />
      <Toasts />
      {saveVersionOpen && (
        <SaveVersionDialog
          busy={versionBusy}
          onCancel={() => {
            if (!versionBusy) setSaveVersionOpen(false);
          }}
          onSave={(title) => {
            void createVersion("checkpoint", title).then((saved) => {
              if (saved) setSaveVersionOpen(false);
            });
          }}
        />
      )}
      {incomingCharacter && (
        <IncomingCharacterDialog
          characterName={incomingCharacter.preview.character.meta.name}
          schemaVersion={incomingCharacter.preview.character.schemaVersion}
          issues={incomingCharacter.preview.issues}
          targetName={incomingTargetName}
          nameMismatch={incomingNameMismatch}
          busy={versionBusy}
          onApply={() => void applyIncomingCharacter()}
          onChooseTarget={() => void chooseIncomingTarget()}
          onCancel={cancelIncomingCharacter}
        />
      )}
    </div>
  );
}
