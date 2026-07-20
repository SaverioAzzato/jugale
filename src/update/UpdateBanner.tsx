import { useState } from "react";
import { useUpdate } from "./useUpdate";
import { useT } from "../i18n/useI18n";

/** A slim bar shown when a newer version exists: install-in-place on desktop, open-the-APK on
 *  Android. Renders nothing (and costs nothing) until the check finds an update. */
export function UpdateBanner() {
  const state = useUpdate((s) => s.state);
  const dismiss = useUpdate((s) => s.dismiss);
  const t = useT();
  const [applying, setApplying] = useState(false);

  if (state.status !== "available") return null;
  const actionLabel = applying
    ? t(state.kind === "install" ? "update.installing" : "update.downloading")
    : t(state.kind === "install" ? "update.install" : "update.download");

  async function apply() {
    if (state.status !== "available" || applying) return;
    setApplying(true);
    try {
      await state.apply();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="update-banner-text">
        {t("update.available")} <strong>{state.version}</strong>
      </span>
      <button type="button" className="btn update-banner-action" onClick={() => void apply()} disabled={applying}>
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
