import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { AppOverlay } from "../app/useOverlayNavigation";
import { useT } from "../i18n/useI18n";
import { PencilIcon } from "./AppIcons";
import { DicePalette } from "./DicePalette";
import { HelpButton, PromptsButton, SettingsButton } from "./OverlayButtons";
import { toolbarCapacity, TOOLBAR_PRIORITY, type ToolbarActionId } from "./toolbarLayout";
import { useUiBackHandler } from "./uiBack";
import { useSettings, type DiceButtonPosition } from "./useSettings";

function useToolbarCapacity(
  toolbarRef: RefObject<HTMLElement>,
  leftRef: RefObject<HTMLDivElement>,
  actionCount: number,
  fixedActionCount: number,
): number {
  const uiScale = useSettings((state) => state.uiScale);
  const [capacity, setCapacity] = useState(actionCount);
  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const left = leftRef.current;
    if (!toolbar || !left) return;
    const measure = () => setCapacity(toolbarCapacity(
      toolbar.getBoundingClientRect().width,
      left.getBoundingClientRect().width,
      uiScale / 100,
      actionCount,
      fixedActionCount,
    ));
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

interface AppToolbarProps {
  overlay: AppOverlay | null;
  overlayBackRef: RefObject<HTMLButtonElement>;
  characterOpen: boolean;
  editMode: boolean;
  versionHistory: boolean;
  versionsAvailable: boolean;
  versionBusy: boolean;
  readOnly: boolean;
  liveSync: boolean;
  diceButtonPosition: DiceButtonPosition;
  onBack(): void;
  onImport(): void;
  onExport(): void;
  onEdit(): void;
  onVersion(): void;
  onOverlay(overlay: AppOverlay): void;
}

export function AppToolbar(props: AppToolbarProps) {
  const {
    overlay, overlayBackRef, characterOpen, editMode, versionHistory, versionsAvailable,
    versionBusy, readOnly, liveSync, diceButtonPosition, onBack, onImport, onExport, onEdit, onVersion, onOverlay,
  } = props;
  const t = useT();
  const toolbarRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const presentActions = useMemo<ToolbarActionId[]>(
    () => characterOpen
      ? TOOLBAR_PRIORITY.filter((id) =>
          (id !== "dice" || diceButtonPosition === "toolbar") &&
          (!["version", "history"].includes(id) || (versionHistory && versionsAvailable)))
      : [
          ...(diceButtonPosition === "toolbar" ? (["dice"] as ToolbarActionId[]) : []),
          "import",
          "prompts",
          "settings",
        ],
    [characterOpen, diceButtonPosition, versionHistory, versionsAvailable],
  );
  const capacity = useToolbarCapacity(
    toolbarRef,
    leftRef,
    overlay ? 0 : presentActions.length,
    !overlay && !characterOpen ? 1 : 0,
  );
  const visible = useMemo(() => new Set(presentActions.slice(0, capacity)), [capacity, presentActions]);
  const overflow = useMemo(() => presentActions.filter((id) => !visible.has(id)), [presentActions, visible]);
  const versionDisabled = versionBusy || readOnly || !liveSync;

  return (
    <nav className="toolbar" ref={toolbarRef}>
      <div className="toolbar-left" ref={leftRef}>
        {overlay ? (
          <button ref={overlayBackRef} className="btn btn-back" onClick={onBack} title={t("app.back")} aria-label={t("app.back")}>
            <BackIcon />
          </button>
        ) : characterOpen ? (
          <button className="btn btn-back" onClick={onBack} title={t("app.backTitle")} aria-label={t("app.back")}>
            <BackIcon />
          </button>
        ) : null}
        {overlay && <span className="toolbar-title">{t(overlayTitle(overlay))}</span>}
      </div>
      <div className="toolbar-right">
        {overlay && overlay !== "prompts" && <PromptsButton onClick={() => onOverlay("prompts")} />}
        {overlay && overlay !== "help" && <HelpButton onClick={() => onOverlay("help")} />}
        {overlay && overlay !== "settings" && <SettingsButton onClick={() => onOverlay("settings")} />}
        {!overlay && (
          <>
            {visible.has("import") && <IconButton label={t("app.import")} onClick={onImport}><ImportIcon /></IconButton>}
            {characterOpen && visible.has("export") && <IconButton label={t("app.export")} onClick={onExport}><DownloadIcon /></IconButton>}
            {characterOpen && visible.has("edit") && (
              <button
                className={editMode ? "btn btn-icon edit-toggle-btn is-on" : "btn btn-icon edit-toggle-btn"}
                onClick={onEdit}
                aria-pressed={editMode}
                title={t("edit.toggle")}
                aria-label={t("edit.toggle")}
              ><PencilIcon /></button>
            )}
            {characterOpen && visible.has("version") && (
              <IconButton label={t("versions.save")} onClick={onVersion} disabled={versionDisabled}><SaveVersionIcon /></IconButton>
            )}
            {characterOpen && visible.has("history") && (
              <IconButton label={t("versions.open")} onClick={() => onOverlay("versions")} trigger="versions"><HistoryIcon /></IconButton>
            )}
            {characterOpen && visible.has("raw") && <RawJsonButton onClick={() => onOverlay("json")} label={t("code.toggle")} />}
            {!characterOpen && <HelpButton onClick={() => onOverlay("help")} />}
            {characterOpen && visible.has("help") && <HelpButton onClick={() => onOverlay("help")} />}
            {visible.has("dice") && <DicePalette />}
            {visible.has("prompts") && <PromptsButton onClick={() => onOverlay("prompts")} />}
            {visible.has("settings") && <SettingsButton onClick={() => onOverlay("settings")} />}
            {overflow.length > 0 && (
              <ToolbarOverflow
                actions={overflow}
                onImport={onImport}
                onExport={onExport}
                onEdit={onEdit}
                onVersion={onVersion}
                versionDisabled={versionDisabled}
                onOverlay={onOverlay}
              />
            )}
          </>
        )}
      </div>
    </nav>
  );
}

function overlayTitle(overlay: AppOverlay) {
  if (overlay === "settings") return "settings.title" as const;
  if (overlay === "prompts") return "prompts.title" as const;
  if (overlay === "json") return "rawjson.title" as const;
  if (overlay === "versions") return "versions.title" as const;
  return "help.title" as const;
}

function IconButton({ label, onClick, disabled, trigger, children }: {
  label: string; onClick(): void; disabled?: boolean; trigger?: string; children: React.ReactNode;
}) {
  return <button type="button" className="btn btn-icon" disabled={disabled} onClick={onClick} title={label} aria-label={label} data-overlay-trigger={trigger}>{children}</button>;
}

interface ToolbarOverflowProps {
  actions: ToolbarActionId[];
  onImport(): void;
  onExport(): void;
  onEdit(): void;
  onVersion(): void;
  versionDisabled: boolean;
  onOverlay(overlay: AppOverlay): void;
}

function ToolbarOverflow({ actions, onImport, onExport, onEdit, onVersion, versionDisabled, onOverlay }: ToolbarOverflowProps) {
  const t = useT();
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useUiBackHandler(open, () => { setOpen(false); return true; });
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (open && ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const definitions: Partial<Record<ToolbarActionId, { label: string; run(): void; trigger?: string; disabled?: boolean }>> = {
    edit: { label: t("edit.toggle"), run: onEdit },
    version: { label: t("versions.save"), run: onVersion, disabled: versionDisabled },
    history: { label: t("versions.open"), run: () => onOverlay("versions"), trigger: "versions" },
    import: { label: t("app.import"), run: onImport },
    export: { label: t("app.export"), run: onExport },
    raw: { label: t("code.toggle"), run: () => onOverlay("json"), trigger: "json" },
    prompts: { label: t("prompts.title"), run: () => onOverlay("prompts"), trigger: "prompts" },
    help: { label: t("help.title"), run: () => onOverlay("help"), trigger: "help" },
    settings: { label: t("settings.title"), run: () => onOverlay("settings"), trigger: "settings" },
  };
  return (
    <details className="toolbar-overflow" ref={ref} open={open}>
      <summary className="btn btn-icon toolbar-more" role="button" aria-haspopup="menu" aria-label={t("toolbar.more")} title={t("toolbar.more")} onClick={(event) => { event.preventDefault(); setOpen((value) => !value); }}>
        <span aria-hidden="true">•••</span>
      </summary>
      <div className="toolbar-overflow-menu" role="menu">
        {actions.map((id) => {
          const action = definitions[id];
          if (!action) return null;
          return <button key={id} type="button" role="menuitem" disabled={action.disabled} data-overlay-trigger={action.trigger} onClick={() => { setOpen(false); action.run(); }}>{action.label}</button>;
        })}
      </div>
    </details>
  );
}

function BackIcon() {
  return <svg className="back-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15.5 4.5 8 12l7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function SaveVersionIcon() {
  return <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></svg>;
}

function HistoryIcon() {
  return <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>;
}

function CodeIcon() {
  return <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.5 8 4.5 12l4 4 M15.5 8 19.5 12l-4 4 M13.5 5l-3 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DownloadIcon() {
  return <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ImportIcon() {
  return <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21V9m0 0 5 5m-5-5-5 5M5 4h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function RawJsonButton({ onClick, label }: { onClick(): void; label: string }) {
  return <button className="btn btn-icon code-toggle-btn" onClick={onClick} aria-pressed={false} title={label} aria-label={label} data-overlay-trigger="json"><CodeIcon /></button>;
}
