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
  source,
  valid,
  canChooseTarget,
  createsNew,
  snapshotCurrent,
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
  source: "android-share" | "file-import";
  valid: boolean;
  canChooseTarget: boolean;
  createsNew: boolean;
  snapshotCurrent?: boolean;
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
    <VersionDialog label={t(source === "file-import" ? "import.title" : "incoming.title")} onCancel={() => { if (!busy) onCancel(); }}>
      <h2>{t(source === "file-import" ? "import.title" : "incoming.title")}</h2>
      <p>{interpolate(t(source === "file-import" ? "import.selected" : "incoming.received"), { name: characterName, schema: schemaVersion })}</p>
      <p>{interpolate(t("versions.issueCounts"), { errors, warnings })}</p>
      {targetName ? (
        <p>{interpolate(t("incoming.target"), { name: targetName })}</p>
      ) : canChooseTarget ? (
        <p>{t(source === "file-import" ? "import.chooseTargetFirst" : "incoming.chooseTargetFirst")}</p>
      ) : null}
      <p className="incoming-warning">{t(createsNew || !targetName ? "import.folderWarning" : "incoming.replaceWarning")}</p>
      {snapshotCurrent && <p>{t("import.snapshotCurrent")}</p>}
      {nameMismatch && <p>{t("incoming.nameMismatch")}</p>}
      <div className="version-dialog-actions">
        {targetName && (
          <button type="button" autoFocus className="btn btn-primary" disabled={busy || !valid} onClick={onApply}>
            {interpolate(t(createsNew ? "import.createIn" : "incoming.applyTo"), { name: targetName })}
          </button>
        )}
        {canChooseTarget && (
          <button type="button" className="btn" disabled={busy} onClick={onChooseTarget}>
            {t(targetName ? "incoming.chooseOther" : "incoming.chooseTarget")}
          </button>
        )}
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          {t("prompts.cancel")}
        </button>
      </div>
    </VersionDialog>
  );
}
