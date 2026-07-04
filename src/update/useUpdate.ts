import { create } from "zustand";
import { isTauri } from "../storage/tauriProvider";
import { isAndroid } from "../storage/androidProvider";
import { isNewer } from "./version";
import { useToast } from "../ui/useToast";
import { translate, useI18n } from "../i18n/useI18n";

const REPO = "SaverioAzzato/jugale";

/**
 * In-app update check. Two very different worlds:
 * - **Desktop**: Tauri's signed updater (`plugin-updater`) can download+install and relaunch in
 *   place — `kind: "install"`.
 * - **Android**: Tauri's updater doesn't support mobile, so we ask the GitHub API for the latest
 *   release and, if it's newer, offer to open the APK in the browser — `kind: "download"`. The
 *   request goes through Tauri's **HTTP plugin** (from Rust), not the webview's `fetch`: a raw
 *   webview fetch to api.github.com is unreliable on Android (CORS/CSP/webview quirks), which is
 *   why the banner never appeared there.
 * - **Web**: nothing to do, the page is always the latest.
 *
 * The automatic check at startup is best-effort and **silent** on failure (offline, rate-limited):
 * a broken update check must never get in the way of using the app. A **manual** check (the
 * Settings button) instead reports its outcome — "up to date", or the real error — so the thing is
 * diagnosable on a device we can't reproduce locally.
 */
export type UpdateState =
  | { status: "idle" | "checking" }
  | { status: "available"; version: string; kind: "install" | "download"; apply: () => Promise<void> };

interface UpdateStore {
  state: UpdateState;
  /** `manual` = triggered by the user (report the outcome via toast); default is the silent startup check. */
  check: (manual?: boolean) => Promise<void>;
  dismiss: () => void;
}

function notify(kind: "success" | "error", key: Parameters<typeof translate>[1], detail?: string): void {
  const locale = useI18n.getState().locale;
  useToast.getState().push(kind, translate(locale, key), detail);
}

async function checkDesktop(set: (s: UpdateState) => void, manual: boolean): Promise<void> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) {
    if (manual) notify("success", "update.upToDate");
    return;
  }
  set({
    status: "available",
    version: update.version,
    kind: "install",
    apply: async () => {
      await update.downloadAndInstall();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  });
}

async function checkAndroid(set: (s: UpdateState) => void, manual: boolean): Promise<void> {
  const { fetch } = await import("@tauri-apps/plugin-http");
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`); // surfaced only on a manual check
  const data = (await res.json()) as { tag_name?: string; html_url?: string; assets?: { name: string; browser_download_url: string }[] };
  const tag = data.tag_name;
  if (!tag || !isNewer(tag, __APP_VERSION__)) {
    if (manual) notify("success", "update.upToDate");
    return;
  }
  const apk = data.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
  const url = apk?.browser_download_url ?? data.html_url;
  if (!url) throw new Error("release has no downloadable asset");
  set({
    status: "available",
    version: tag,
    kind: "download",
    apply: async () => {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    },
  });
}

export const useUpdate = create<UpdateStore>((set) => ({
  state: { status: "idle" },
  dismiss: () => set({ state: { status: "idle" } }),
  check: async (manual = false) => {
    if (!isTauri()) {
      if (manual) notify("success", "update.upToDate"); // web is always current
      return;
    }
    set({ state: { status: "checking" } });
    try {
      const apply = (s: UpdateState) => set({ state: s });
      if (isAndroid()) await checkAndroid(apply, manual);
      else await checkDesktop(apply, manual);
    } catch (e) {
      // Auto check stays silent; a manual check reports why it failed.
      if (manual) notify("error", "update.checkFailed", e instanceof Error ? e.message : String(e));
    } finally {
      set((prev) => (prev.state.status === "checking" ? { state: { status: "idle" } } : prev));
    }
  },
}));
