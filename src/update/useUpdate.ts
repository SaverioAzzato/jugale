import { create } from "zustand";
import { isTauri } from "../storage/tauriProvider";
import { isAndroid } from "../storage/androidProvider";
import { isNewer } from "./version";

const REPO = "SaverioAzzato/jugale";

/**
 * In-app update check. Two very different worlds:
 * - **Desktop**: Tauri's signed updater (`plugin-updater`) can download+install and relaunch in
 *   place — `kind: "install"`.
 * - **Android**: Tauri's updater doesn't support mobile, so we just ask the GitHub API for the
 *   latest release and, if it's newer, offer to open the APK in the browser — `kind: "download"`.
 * - **Web**: nothing to do, the page is always the latest.
 *
 * The check is best-effort and silent on failure (offline, rate-limited): a broken update check
 * must never get in the way of using the app.
 */
export type UpdateState =
  | { status: "idle" | "checking" }
  | { status: "available"; version: string; kind: "install" | "download"; apply: () => Promise<void> };

interface UpdateStore {
  state: UpdateState;
  check: () => Promise<void>;
  dismiss: () => void;
}

async function checkDesktop(set: (s: UpdateState) => void): Promise<void> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return; // up to date
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

async function checkAndroid(set: (s: UpdateState) => void): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return;
  const data = (await res.json()) as { tag_name?: string; html_url?: string; assets?: { name: string; browser_download_url: string }[] };
  const tag = data.tag_name;
  if (!tag || !isNewer(tag, __APP_VERSION__)) return;
  const apk = data.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
  const url = apk?.browser_download_url ?? data.html_url;
  if (!url) return;
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
  check: async () => {
    if (!isTauri()) return; // web is always current
    set({ state: { status: "checking" } });
    try {
      const apply = (s: UpdateState) => set({ state: s });
      if (isAndroid()) await checkAndroid(apply);
      else await checkDesktop(apply);
    } catch {
      // Silent: offline / rate-limited / updater not reachable. Reset to idle.
    } finally {
      set((prev) => (prev.state.status === "checking" ? { state: { status: "idle" } } : prev));
    }
  },
}));
