import { useState } from "react";
import { useUpdate, type UpdateProgress } from "./useUpdate";
import { useT } from "../i18n/useI18n";
import { useToast } from "../ui/useToast";

/** A slim bar shown when a newer version exists: install-in-place on desktop, open-the-APK on
 *  Android. Renders nothing (and costs nothing) until the check finds an update. */
export function UpdateBanner() {
  const state = useUpdate((s) => s.state);
  const dismiss = useUpdate((s) => s.dismiss);
  const pushToast = useToast((s) => s.push);
  const t = useT();
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  if (state.status !== "available") return null;
  const actionLabel = t(state.kind === "install" ? "update.install" : "update.download");
  const percentage = progress && progress.total > 0
    ? Math.min(100, Math.max(0, Math.round((progress.downloaded / progress.total) * 100)))
    : null;

  async function apply() {
    if (state.status !== "available" || applying) return;
    setApplying(true);
    setProgress(null);
    try {
      await state.apply(setProgress);
    } catch (error) {
      pushToast("error", t("update.failed"), error instanceof Error ? error.message : String(error));
    } finally {
      setApplying(false);
      setProgress(null);
    }
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner-text">
        {applying ? (
          <>
            {t(state.kind === "install" ? "update.installing" : "update.downloading")}
            {percentage !== null && <> <strong>{percentage}%</strong></>}
          </>
        ) : (
          <>{t("update.available")} <strong>{state.version}</strong></>
        )}
      </span>
      {!applying && (
        <>
          <button type="button" className="btn update-banner-action" onClick={() => void apply()}>
            {actionLabel}
          </button>
          <button
            type="button"
            className="update-banner-dismiss"
            onClick={dismiss}
            aria-label={t("update.dismiss")}
            title={t("update.dismiss")}
          >
            ×
          </button>
        </>
      )}
      {applying && (
        <div
          className={`update-progress${percentage === null ? " is-indeterminate" : ""}`}
          role="progressbar"
          aria-label={t("update.progress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage ?? undefined}
        >
          <span style={percentage === null ? undefined : { width: `${percentage}%` }} />
        </div>
      )}
    </div>
  );
}
