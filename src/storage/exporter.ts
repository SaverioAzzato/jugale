/**
 * "Save a copy / export" — a one-shot write of the character JSON to a user-chosen destination,
 * independent of live-sync. Unlike `StorageProvider.write` (which writes back to the *bound*
 * source), this always asks the user where to put a fresh copy and reports back where it went,
 * so the UI can confirm the export and — where the platform allows — name the location.
 *
 * Host capabilities differ, and we report them honestly rather than inventing a path that
 * doesn't exist:
 * - Desktop (Tauri): native Save dialog → absolute path. `kind: "path"`.
 * - Android (SAF): system file-saver → a content:// URI; only a display name is knowable
 *   (Android has no user-facing file paths). Also lists Google Drive. `kind: "name"`.
 * - Chromium web: File System Access save picker → the chosen filename only (the browser hides
 *   the absolute path). `kind: "name"`.
 * - Firefox/Safari: no save picker — an <a download> blob the browser routes to its downloads
 *   location without telling us where. `kind: "download"`.
 */
import { saveCharacterAsWeb } from "./provider";
import { isTauri, saveCharacterAsTauri } from "./tauriProvider";
import { isAndroid, saveCharacterAsAndroid } from "./androidProvider";

export type ExportOutcome =
  | { status: "saved"; kind: "path" | "name" | "download"; location: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/** Serialize + save a copy of `data` to a user-chosen destination, dispatching per host. */
export async function saveCharacterAs(data: unknown, defaultName: string): Promise<ExportOutcome> {
  const json = JSON.stringify(data, null, 2);
  try {
    if (isAndroid()) {
      const name = await saveCharacterAsAndroid(json, defaultName);
      return name === null ? { status: "cancelled" } : { status: "saved", kind: "name", location: name };
    }
    if (isTauri()) {
      const path = await saveCharacterAsTauri(json, defaultName);
      return path === null ? { status: "cancelled" } : { status: "saved", kind: "path", location: path };
    }
    const res = await saveCharacterAsWeb(json, defaultName);
    if (res === null) return { status: "cancelled" };
    return { status: "saved", kind: res.picked ? "name" : "download", location: res.name };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
