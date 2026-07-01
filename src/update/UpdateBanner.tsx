import { useUpdate } from "./useUpdate";
import { useT } from "../i18n/useI18n";

/** A slim bar shown when a newer version exists: install-in-place on desktop, open-the-APK on
 *  Android. Renders nothing (and costs nothing) until the check finds an update. */
export function UpdateBanner() {
  const state = useUpdate((s) => s.state);
  const dismiss = useUpdate((s) => s.dismiss);
  const t = useT();

  if (state.status !== "available") return null;
  const actionLabel = state.kind === "install" ? t("update.install") : t("update.download");

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner-text">
        {t("update.available")} <strong>{state.version}</strong>
      </span>
      <button type="button" className="btn update-banner-action" onClick={() => void state.apply()}>
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
    </div>
  );
}
