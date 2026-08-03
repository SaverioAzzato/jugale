/**
 * Android (Tauri) implementation of the `StorageProvider` surface. Android has no real file
 * paths: the system hands back Storage Access Framework (SAF) `content://` URIs, which the stock
 * Tauri `dialog`/`fs` plugins don't handle — they can't write back to them, can't persist access
 * across restarts, and treat a folder tree URI as if it were a path. That's why the desktop
 * `tauriProvider` fails on Android (read-only saves, dead recents, "invalid JSON" on open-folder).
 *
 * `tauri-plugin-android-fs` fixes all three: it opens files/folders via SAF, persists the
 * read+write permission across restarts, and reads/writes the URI in place. So the character.json
 * stays the single source of truth **at its original location** and is saved live, exactly like
 * desktop — no copy-into-app, no export-only.
 *
 * Cloud caveats (platform limits, not bugs we can fix):
 * - **Google Drive is absent from the folder picker.** Drive's DocumentsProvider does not
 *   implement `ACTION_OPEN_DOCUMENT_TREE`, so a Drive folder can never be tree-picked on Android.
 *   Drive-hosted characters must be opened via the *single-file* picker (`ACTION_OPEN_DOCUMENT`,
 *   which does list Drive) — at the cost of the sibling `images/` folder.
 * - **Persistable permission may be refused** (Drive, some providers): opening still works for the
 *   session, we just can't silently reopen from Recents — see `tryPersist`.
 * - **Write-back may be refused**: when a save fails the store falls back to read-only + export,
 *   exactly like the web path.
 */
import { AndroidFs, AndroidUriPermissionState, type AndroidFsUri } from "tauri-plugin-android-fs-api";
import { isTauri } from "./tauriProvider";
import type { StorageProvider, GalleryImage, AndroidRecentRef, LoadedCharacter } from "./provider";
import type { PersistableCharacterDocument } from "../schema/validate";
import { normalizeStorageError, storageError } from "./errors";
import { createVersionStore, type VersionStore } from "./versions";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
export const IMPORT_TARGET_NOT_EMPTY = "import-target-not-empty";
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

/** True when running inside the Tauri shell on Android specifically (not desktop Tauri). */
export function isAndroid(): boolean {
  return isTauri() && typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/**
 * Persist the SAF read+write grant so Recents can reopen the source after a restart. This is
 * **best-effort**: some document providers — most notably Google Drive — hand back a URI that
 * can be read for the session but refuse a *persistable* permission, so
 * `persistPickerUriPermission` throws. That must never abort the open (the picker already granted
 * session-scoped access); we just lose the ability to silently reopen it later. Swallowing this
 * is what stops a Drive-hosted file from failing with a misleading "invalid JSON".
 */
async function tryPersist(uri: AndroidFsUri): Promise<void> {
  try {
    await AndroidFs.persistPickerUriPermission(uri);
  } catch (err) {
    console.warn("[android-fs] could not persist SAF permission (Recents may not reopen this source):", err);
  }
}

class AndroidFsProvider implements StorageProvider {
  readonly kind = "file";
  constructor(private fileUri: AndroidFsUri) {}

  async read(): Promise<unknown> {
    // Decode raw bytes ourselves rather than using the plugin's readTextFile: on some Android
    // WebViews the IPC payload arrives as a plain number[] instead of an ArrayBuffer, and
    // readTextFile feeds it straight to TextDecoder.decode → "parameter 1 is not of type
    // 'ArrayBuffer'". readFile normalizes to a Uint8Array; Uint8Array.from() is a belt-and-braces
    // guard so either payload shape decodes cleanly. (See tauri-apps/tauri#11959.)
    let text: string;
    try {
      const bytes = await AndroidFs.readFile(this.fileUri);
      text = new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
    } catch (error) {
      throw normalizeStorageError(error);
    }
    return JSON.parse(text);
  }

  /** Truncating in-place write (append defaults to false), so the source file stays canonical. */
  async write(data: PersistableCharacterDocument): Promise<void> {
    try {
      await AndroidFs.writeTextFile(this.fileUri, JSON.stringify(data.document, null, 2));
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

class AndroidFolderProvider extends AndroidFsProvider {
  readonly versions: VersionStore;

  constructor(characterUri: AndroidFsUri, treeUri: AndroidFsUri) {
    super(characterUri);
    const existingHistory = async () => {
      const rootEntries = await AndroidFs.readDir(treeUri);
      return rootEntries.find((entry) => entry.type === "Dir" && entry.name === "history")?.uri ?? null;
    };
    const entries = async () => {
      const historyUri = await existingHistory();
      return historyUri ? AndroidFs.readDir(historyUri) : [];
    };
    this.versions = createVersionStore({
      listNames: async () => (await entries())
        .filter((entry) => entry.type === "File")
        .map((entry) => entry.name),
      writeText: async (filename, contents) => {
        const historyUri = await AndroidFs.createDir(treeUri, "history");
        const uri = await AndroidFs.createNewFile(historyUri, filename, "application/json");
        await AndroidFs.writeTextFile(uri, contents);
      },
      readText: async (filename) => {
        const file = (await entries()).find((entry) => entry.type === "File" && entry.name === filename);
        if (!file) throw storageError("not-found", undefined, `Missing history/${filename}`);
        const bytes = await AndroidFs.readFile(file.uri);
        return new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
      },
      remove: async (filename) => {
        const file = (await entries()).find((entry) => entry.type === "File" && entry.name === filename);
        if (!file) throw storageError("not-found", undefined, `Missing history/${filename}`);
        await AndroidFs.removeFile(file.uri);
      },
    });
  }
}

/** Resolve a picked folder (tree URI) to its character.json URI + alphabetized `images/`.
 *  Throws NO_CHARACTER_JSON if the folder has none. */
async function resolveFolder(treeUri: AndroidFsUri): Promise<{ fileUri: AndroidFsUri; images: GalleryImage[] }> {
  const entries = await AndroidFs.readDir(treeUri);
  const jsonEntry = entries.find((e) => e.type === "File" && e.name === "character.json");
  if (!jsonEntry) throw storageError("no-character-json");

  const imagesDir = entries.find((e) => e.type === "Dir" && e.name === "images");
  const images: GalleryImage[] = [];
  if (imagesDir) {
    const imgEntries = (await AndroidFs.readDir(imagesDir.uri))
      .filter((e) => e.type === "File" && IMAGE_RE.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of imgEntries) {
      // A single unreadable image (provider quirk, revoked grant) must not sink the whole
      // character load — skip it and keep going.
      try {
        const bytes = await AndroidFs.readFile(e.uri);
        const ext = e.name.split(".").pop()?.toLowerCase() ?? "";
        const blob = new Blob([bytes as BlobPart], { type: MIME[ext] ?? "application/octet-stream" });
        images.push({ name: `images/${e.name}`, url: URL.createObjectURL(blob) });
      } catch (err) {
        console.error(`[android-fs] skipping unreadable image ${e.name}:`, err);
      }
    }
  }
  return { fileUri: jsonEntry.uri, images };
}

/** Opens a single character.json via SAF for live read/write. Null if cancelled. */
export async function openCharacterFileAndroid(): Promise<{
  provider: StorageProvider;
  raw: unknown;
  ref: AndroidRecentRef;
} | null> {
  const uris = await AndroidFs.showOpenFilePicker();
  const fileUri = uris?.[0];
  if (!fileUri) return null;
  await tryPersist(fileUri);
  const name = await AndroidFs.getName(fileUri).catch(() => "character.json");
  const provider = new AndroidFsProvider(fileUri);
  return {
    provider,
    raw: await provider.read(),
    ref: { platform: "android", kind: "file", name, uri: fileUri },
  };
}

/**
 * Opens a character *folder* (`character.json` + optional `images/`) via SAF. This is the
 * preferred Android path — a tree URI grants persistable read+write and exposes the `images/`
 * sibling. Null if cancelled; throws NO_CHARACTER_JSON if the folder has none.
 */
export async function openCharacterFolderAndroid(): Promise<{
  provider: StorageProvider;
  raw: unknown;
  images: GalleryImage[];
  sourceName: string;
  ref: AndroidRecentRef;
} | null> {
  const treeUri = await AndroidFs.showOpenDirPicker();
  if (!treeUri) return null;
  await tryPersist(treeUri);
  const { fileUri, images } = await resolveFolder(treeUri);
  const name = await AndroidFs.getName(treeUri).catch(() => "character");
  const provider = new AndroidFolderProvider(fileUri, treeUri);
  return {
    provider,
    raw: await provider.read(),
    images,
    sourceName: name,
    ref: { platform: "android", kind: "folder", name, uri: treeUri },
  };
}

export type AndroidImportTarget =
  | ({ kind: "existing" } & NonNullable<Awaited<ReturnType<typeof openCharacterFolderAndroid>>>)
  | {
      kind: "empty";
      sourceName: string;
      ref: AndroidRecentRef;
      create: (document: PersistableCharacterDocument) => Promise<LoadedCharacter>;
    };

/** Pick an import destination without changing it. Existing characters are loaded for preview;
 * a truly empty folder exposes a deferred creator so character.json is written only after the
 * user confirms. A non-empty folder without character.json is rejected. */
export async function pickCharacterImportTargetAndroid(): Promise<AndroidImportTarget | null> {
  const treeUri = await AndroidFs.showOpenDirPicker();
  if (!treeUri) return null;
  await tryPersist(treeUri);
  const entries = await AndroidFs.readDir(treeUri);
  const sourceName = await AndroidFs.getName(treeUri).catch(() => "character");
  const ref: AndroidRecentRef = { platform: "android", kind: "folder", name: sourceName, uri: treeUri };
  if (entries.some((entry) => entry.type === "File" && entry.name === "character.json")) {
    const { fileUri, images } = await resolveFolder(treeUri);
    const provider = new AndroidFolderProvider(fileUri, treeUri);
    return { kind: "existing", provider, raw: await provider.read(), images, sourceName, ref };
  }
  if (entries.length > 0) throw storageError("import-target-not-empty");
  return {
    kind: "empty",
    sourceName,
    ref,
    create: async (document) => {
      const fileUri = await AndroidFs.createNewFile(treeUri, "character.json", "application/json");
      const provider = new AndroidFolderProvider(fileUri, treeUri);
      try {
        await provider.write(document);
        return { provider, raw: await provider.read(), images: [], sourceName };
      } catch (error) {
        await AndroidFs.removeFile(fileUri).catch(() => undefined);
        throw error;
      }
    },
  };
}

/**
 * "Save a copy" via the Android system file-saver (SAF `ACTION_CREATE_DOCUMENT`, which — unlike
 * the folder/tree picker — *does* list Google Drive). Writes the JSON to the new document and
 * returns its display name, or null if the user cancelled. Android has no user-facing file paths,
 * so a display name is the most we can report. This is an export, independent of any bound source.
 */
export async function saveJsonAsAndroid(
  json: string,
  defaultName: string,
  mime = "application/json",
): Promise<string | null> {
  const uri = await AndroidFs.showSaveFilePicker(defaultName, mime);
  if (!uri) return null;
  await AndroidFs.writeTextFile(uri, json);
  return await AndroidFs.getName(uri).catch(() => defaultName);
}

/** Re-resolve an Android RecentRef via its persisted SAF permission. Throws NO_CHARACTER_JSON if
 *  the permission was lost (user cleared it / the entry is gone) or the folder no longer has one. */
export async function reopenAndroid(ref: AndroidRecentRef): Promise<LoadedCharacter> {
  const uri = ref.uri;
  const usable = await AndroidFs.checkPersistedPickerUriPermission(uri, AndroidUriPermissionState.ReadOrWrite);
  if (!usable) throw storageError("permission-denied");

  if (ref.kind === "folder") {
    const { fileUri, images } = await resolveFolder(uri);
    const provider = new AndroidFolderProvider(fileUri, uri);
    return { provider, raw: await provider.read(), images, sourceName: ref.name };
  }
  const provider = new AndroidFsProvider(uri);
  return { provider, raw: await provider.read(), images: [], sourceName: ref.name };
}
