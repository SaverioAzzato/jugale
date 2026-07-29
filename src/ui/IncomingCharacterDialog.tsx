import { interpolate, useT } from "../i18n/useI18n";
import type { Issue } from "../schema";
import { useUiBackHandler } from "./uiBack";
import { VersionDialog } from "./VersionDialog";

export function IncomingCharacterDialog({
  characterName,
  schemaVersion,
  issues,
  targetName,
  nameMismatch,
  busy,
  onApply,
  onChooseTarget,
  onCancel,
}: {
  characterName: string;
  schemaVersion: string;
  issues: Issue[];
  targetName: string | null;
  nameMismatch: boolean;
  busy: boolean;
  onApply: () => void;
  onChooseTarget: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  useUiBackHandler(true, () => {
    if (!busy) onCancel();
    return true;
  });

  return (
    <VersionDialog label={t("incoming.title")} onCancel={() => { if (!busy) onCancel(); }}>
      <h2>{t("incoming.title")}</h2>
      <p>{interpolate(t("incoming.received"), { name: characterName, schema: schemaVersion })}</p>
      <p>{interpolate(t("versions.issueCounts"), { errors, warnings })}</p>
      {targetName ? (
        <p>{interpolate(t("incoming.target"), { name: targetName })}</p>
      ) : (
        <p>{t("incoming.chooseTargetFirst")}</p>
      )}
      <p className="incoming-warning">{t("incoming.replaceWarning")}</p>
      {nameMismatch && <p>{t("incoming.nameMismatch")}</p>}
      <div className="version-dialog-actions">
        {targetName && (
          <button type="button" autoFocus className="btn btn-primary" disabled={busy} onClick={onApply}>
            {interpolate(t("incoming.applyTo"), { name: targetName })}
          </button>
        )}
        <button type="button" className="btn" disabled={busy} onClick={onChooseTarget}>
          {t(targetName ? "incoming.chooseOther" : "incoming.chooseTarget")}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          {t("prompts.cancel")}
        </button>
      </div>
    </VersionDialog>
  );
}
