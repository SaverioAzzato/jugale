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
 * desktop — no copy-into-app, no export-only. Cloud providers (e.g. Google Drive) may still refuse
 * write-back regardless; when a save fails the store falls back to read-only + export as elsewhere.
 */
import { AndroidFs, AndroidUriPermissionState, type AndroidFsUri } from "tauri-plugin-android-fs-api";
import { isTauri } from "./tauriProvider";
import type { StorageProvider, GalleryImage, RecentRef, LoadedCharacter } from "./provider";
import { NO_CHARACTER_JSON } from "./provider";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
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

class AndroidFsProvider implements StorageProvider {
  readonly kind = "file";
  constructor(private fileUri: AndroidFsUri) {}

  async read(): Promise<unknown> {
    return JSON.parse(await AndroidFs.readTextFile(this.fileUri));
  }

  /** Truncating in-place write (append defaults to false), so the source file stays canonical. */
  async write(data: unknown): Promise<void> {
    await AndroidFs.writeTextFile(this.fileUri, JSON.stringify(data, null, 2));
  }
}

/** Resolve a picked folder (tree URI) to its character.json URI + alphabetized `images/`.
 *  Throws NO_CHARACTER_JSON if the folder has none. */
async function resolveFolder(treeUri: AndroidFsUri): Promise<{ fileUri: AndroidFsUri; images: GalleryImage[] }> {
  const entries = await AndroidFs.readDir(treeUri);
  const jsonEntry = entries.find((e) => e.type === "File" && e.name === "character.json");
  if (!jsonEntry) throw new Error(NO_CHARACTER_JSON);

  const imagesDir = entries.find((e) => e.type === "Dir" && e.name === "images");
  const images: GalleryImage[] = [];
  if (imagesDir) {
    const imgEntries = (await AndroidFs.readDir(imagesDir.uri))
      .filter((e) => e.type === "File" && IMAGE_RE.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of imgEntries) {
      const bytes = await AndroidFs.readFile(e.uri);
      const ext = e.name.split(".").pop()?.toLowerCase() ?? "";
      const blob = new Blob([bytes as BlobPart], { type: MIME[ext] ?? "application/octet-stream" });
      images.push({ name: `images/${e.name}`, url: URL.createObjectURL(blob) });
    }
  }
  return { fileUri: jsonEntry.uri, images };
}

/** Opens a single character.json via SAF for live read/write. Null if cancelled. */
export async function openCharacterFileAndroid(): Promise<{
  provider: StorageProvider;
  raw: unknown;
  ref: RecentRef;
} | null> {
  const uris = await AndroidFs.showOpenFilePicker();
  const fileUri = uris?.[0];
  if (!fileUri) return null;
  await AndroidFs.persistPickerUriPermission(fileUri);
  const name = await AndroidFs.getName(fileUri);
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
  ref: RecentRef;
} | null> {
  const treeUri = await AndroidFs.showOpenDirPicker();
  if (!treeUri) return null;
  await AndroidFs.persistPickerUriPermission(treeUri);
  const { fileUri, images } = await resolveFolder(treeUri);
  const name = await AndroidFs.getName(treeUri);
  const provider = new AndroidFsProvider(fileUri);
  return {
    provider,
    raw: await provider.read(),
    images,
    sourceName: name,
    ref: { platform: "android", kind: "folder", name, uri: treeUri },
  };
}

/** Re-resolve an Android RecentRef via its persisted SAF permission. Throws NO_CHARACTER_JSON if
 *  the permission was lost (user cleared it / the entry is gone) or the folder no longer has one. */
export async function reopenAndroid(ref: RecentRef): Promise<LoadedCharacter> {
  const uri = ref.uri as AndroidFsUri | undefined;
  if (!uri) throw new Error(NO_CHARACTER_JSON);
  const usable = await AndroidFs.checkPersistedPickerUriPermission(uri, AndroidUriPermissionState.ReadOrWrite);
  if (!usable) throw new Error(NO_CHARACTER_JSON);

  if (ref.kind === "folder") {
    const { fileUri, images } = await resolveFolder(uri);
    const provider = new AndroidFsProvider(fileUri);
    return { provider, raw: await provider.read(), images, sourceName: ref.name };
  }
  const provider = new AndroidFsProvider(uri);
  return { provider, raw: await provider.read(), images: [], sourceName: ref.name };
}
