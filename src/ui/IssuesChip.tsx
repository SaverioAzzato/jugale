import { useEffect, useRef, useState } from "react";
import type { Issue, IssueCode } from "../schema";
import { interpolate, useT, type TFn } from "../i18n/useI18n";

const MESSAGE_KEY: Partial<Record<IssueCode, "issues.levelExceeds20" | "issues.proficiencyBonusMismatch" | "issues.resourceOverspent" | "issues.hpExceedsMax">> = {
  levelExceeds20: "issues.levelExceeds20",
  proficiencyBonusMismatch: "issues.proficiencyBonusMismatch",
  resourceOverspent: "issues.resourceOverspent",
  hpExceedsMax: "issues.hpExceedsMax",
};

/** Localized issue text. Known codes interpolate a translated template; raw schema errors
 * (code "schema") show their English Zod message as-is — they aren't enumerable to localize. */
function describeIssue(issue: Issue, t: TFn): string {
  const key = MESSAGE_KEY[issue.code];
  if (!key) return issue.message;
  return issue.params ? interpolate(t(key), issue.params) : t(key);
}

/** Footer chip with the error/warning count; opens a popover listing every validation issue. */
export function IssuesChip({ issues }: { issues: Issue[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ bottom: number; right: number }>({ bottom: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (issues.length === 0) return null;

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = toggleRef.current?.getBoundingClientRect();
    if (r) setPos({ bottom: window.innerHeight - r.top + 8, right: window.innerWidth - r.right });
    setOpen(true);
  };

  return (
    <div className="issues-chip" ref={ref}>
      <button
        ref={toggleRef}
        type="button"
        className="issues-toggle"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("issues.title")}
        onClick={toggle}
      >
        {errors.length > 0 && (
          <span className="issues-count issues-count-error">
            <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <circle cx="50" cy="50" r="42" />
            </svg>
            {errors.length}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="issues-count issues-count-warning">
            <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <polygon points="50,10 92,82 8,82" />
            </svg>
            {warnings.length}
          </span>
        )}
      </button>
      {open && (
        <div className="issues-panel" role="dialog" aria-label={t("issues.title")} style={{ bottom: pos.bottom, right: pos.right }}>
          <div className="issues-panel-header">
            <span>{t("issues.title")}</span>
            <button type="button" className="issues-panel-close" aria-label={t("issues.close")} onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <ul className="issues-list">
            {issues.map((issue, i) => (
              <li key={i} className={`issue-row issue-row-${issue.severity}`}>
                <span className="issue-severity">{issue.severity === "error" ? t("issues.error") : t("issues.warning")}</span>
                <span className="issue-message">{describeIssue(issue, t)}</span>
                <span className="issue-path">
                  {t("issues.field")}: {issue.path}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
