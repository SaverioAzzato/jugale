import { useToast } from "./useToast";
import { translate, useI18n } from "../i18n/useI18n";
import type { ExportOutcome } from "../storage/exporter";

/**
 * Turn a `saveJsonAs` outcome into the standard toast — shared by the character export and the
 * JSON-Schema download so both confirm the same way and name the destination where the host can
 * report one (absolute path on desktop, filename on Android/Chromium, a "check downloads" hint on
 * Firefox/Safari). Cancelling says nothing; a write failure shows a red error toast.
 *
 * Returns true when a file was actually written, so callers can react (e.g. clear a dirty flag).
 */
export function notifySaveOutcome(outcome: ExportOutcome): boolean {
  const locale = useI18n.getState().locale;
  const push = useToast.getState().push;
  if (outcome.status === "cancelled") return false; // user backed out of the picker
  if (outcome.status === "error") {
    push("error", translate(locale, "toast.exportFailed"), outcome.message);
    return false;
  }
  const detail = outcome.kind === "download" ? translate(locale, "toast.checkDownloads") : outcome.location;
  push("success", translate(locale, "toast.exported"), detail);
  return true;
}
