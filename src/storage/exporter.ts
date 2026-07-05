/**
 * "Save a copy / export" — a one-shot write of a JSON payload (a character, or the downloadable
 * JSON Schema) to a user-chosen destination, independent of live-sync. Unlike
 * `StorageProvider.write` (which writes back to the *bound* source), this always asks the user
 * where to put the file and reports back where it went, so the UI can confirm the save and —
 * where the platform allows — name the location.
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
import { saveJsonAsWeb } from "./provider";
import { isTauri, saveJsonAsTauri } from "./tauriProvider";
import { isAndroid, saveJsonAsAndroid } from "./androidProvider";

export type ExportOutcome =
  | { status: "saved"; kind: "path" | "name" | "download"; location: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/** Save an already-serialized string to a user-chosen destination, dispatching per host. The
 *  `mime` steers the host's save picker (extension/filter); the filename carries the extension. */
async function saveStringAs(content: string, defaultName: string, mime: string): Promise<ExportOutcome> {
  try {
    if (isAndroid()) {
      const name = await saveJsonAsAndroid(content, defaultName, mime);
      return name === null ? { status: "cancelled" } : { status: "saved", kind: "name", location: name };
    }
    if (isTauri()) {
      const path = await saveJsonAsTauri(content, defaultName);
      return path === null ? { status: "cancelled" } : { status: "saved", kind: "path", location: path };
    }
    const res = await saveJsonAsWeb(content, defaultName, mime);
    if (res === null) return { status: "cancelled" };
    return { status: "saved", kind: res.picked ? "name" : "download", location: res.name };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Serialize + save a copy of `data` (a character, or the JSON Schema) to a user-chosen destination. */
export async function saveJsonAs(data: unknown, defaultName: string): Promise<ExportOutcome> {
  return saveStringAs(JSON.stringify(data, null, 2), defaultName, "application/json");
}

/** Save a plain-text/Markdown document (e.g. the schema changelog) to a user-chosen destination. */
export async function saveTextAs(
  text: string,
  defaultName: string,
  mime = "text/markdown",
): Promise<ExportOutcome> {
  return saveStringAs(text, defaultName, mime);
}
