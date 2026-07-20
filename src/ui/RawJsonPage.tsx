import { useEffect, useRef, useState } from "react";
import { useCharacter } from "../state/store";
import { useT } from "../i18n/useI18n";
import type { JsonEditorHandle, PanelDiagnostic } from "./jsonEditor";

/**
 * The raw-JSON view: a full-page CodeMirror editor over `character.json`, with syntax + schema
 * squiggles and a mobile-friendly "Problems" panel (tap a problem to jump to its line). CodeMirror
 * is dynamically imported so it never enters the main bundle. Editing goes through the store's
 * `setRawJson`, which reuses the normal save pipeline (live-sync, else in-memory → export) — the
 * save dynamics are unchanged from the rest of the app.
 */
export function RawJsonPage() {
  const t = useT();
  const setRawJson = useCharacter((s) => s.setRawJson);
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<JsonEditorHandle | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestText = useRef<string>("");

  const [diagnostics, setDiagnostics] = useState<PanelDiagnostic[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  // Commit valid JSON to the store (debounced). Invalid JSON is left uncommitted — the squiggles
  // and the Problems panel already show why — so the sheet keeps the last good state.
  const commit = (text: string) => {
    try {
      setRawJson(JSON.parse(text));
    } catch {
      /* syntax error: reported inline; don't touch the store */
    }
  };

  useEffect(() => {
    let cancelled = false;
    const initial = JSON.stringify(useCharacter.getState().character ?? {}, null, 2);
    latestText.current = initial;

    void import("./jsonEditor").then(({ createJsonEditor }) => {
      if (cancelled || !hostRef.current) return;
      handleRef.current = createJsonEditor(hostRef.current, {
        doc: initial,
        onDocChange: (text) => {
          latestText.current = text;
          if (commitTimer.current) clearTimeout(commitTimer.current);
          commitTimer.current = setTimeout(() => commit(text), 400);
        },
        onDiagnostics: setDiagnostics,
      });
    });

    return () => {
      cancelled = true;
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commit(latestText.current); // flush the last edit so nothing is lost on the way out
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // Mount once: the editor owns its text while open; the store character is read only for the
    // seed above, so committing back never remounts or fights the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.length - errors;

  return (
    <div className="rawjson-page">
      <div className="rawjson-bar">
        <span className="rawjson-summary" role="status" aria-live="polite">
          {diagnostics.length === 0 ? (
            <span className="rawjson-ok">{t("rawjson.ok")}</span>
          ) : (
            <>
              {errors > 0 && <span className="rawjson-count is-error">⛔ {errors}</span>}
              {warnings > 0 && <span className="rawjson-count is-warning">⚠ {warnings}</span>}
            </>
          )}
        </span>
        <div className="rawjson-actions">
          <button
            type="button"
            className="btn btn-icon rawjson-tool-btn"
            onClick={() => handleRef.current?.openSearch()}
            title={t("rawjson.search")}
            aria-label={t("rawjson.search")}
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            className="btn btn-icon rawjson-tool-btn"
            onClick={() => handleRef.current?.foldAll()}
            title={t("rawjson.collapseAll")}
            aria-label={t("rawjson.collapseAll")}
          >
            <CollapseIcon />
          </button>
          <button
            type="button"
            className="btn btn-icon rawjson-tool-btn"
            onClick={() => handleRef.current?.unfoldAll()}
            title={t("rawjson.expandAll")}
            aria-label={t("rawjson.expandAll")}
          >
            <ExpandIcon />
          </button>
          <button
            type="button"
            className="btn rawjson-suggest-btn"
            onClick={() => handleRef.current?.triggerCompletion()}
            title={t("rawjson.suggest")}
          >
            <LightbulbIcon />
            <span className="rawjson-suggest-label">{t("rawjson.suggest")}</span>
          </button>
          <button
            type="button"
            className={panelOpen ? "btn rawjson-problems-btn is-on" : "btn rawjson-problems-btn"}
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            disabled={diagnostics.length === 0}
          >
            {t("rawjson.problems")} ({diagnostics.length})
          </button>
        </div>
      </div>

      <div className="rawjson-editor" ref={hostRef} />

      {panelOpen && (
        <ul className="rawjson-problems">
          {diagnostics.length === 0 ? (
            <li className="rawjson-problem-empty">{t("rawjson.noProblems")}</li>
          ) : (
            diagnostics.map((d, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`rawjson-problem is-${d.severity}`}
                  onClick={() => handleRef.current?.reveal(d.from, d.to)}
                >
                  <span className="rawjson-problem-line">{t("rawjson.line")} {d.line}</span>
                  <span className="rawjson-problem-msg">{d.message}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** A lightbulb — the Suggest affordance (open schema-aware suggestions at the cursor). */
function LightbulbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1v.2h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
    </svg>
  );
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Magnifier — open the find / replace panel. */
function SearchIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

/** Chevrons pointing inward — collapse every section. */
function CollapseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 4l5 5 5-5" />
      <path d="M7 20l5-5 5 5" />
    </svg>
  );
}

/** Chevrons pointing outward — expand every section. */
function ExpandIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 9l5-5 5 5" />
      <path d="M7 15l5 5 5-5" />
    </svg>
  );
}
