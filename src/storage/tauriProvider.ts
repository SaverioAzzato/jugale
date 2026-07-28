/**
 * Native (Tauri 2) implementation of the same `StorageProvider` surface the browser File
 * System Access path offers — desktop/mobile shells always have live read/write, so there's
 * no read-only or import/export fallback here. The dialog plugin's open() call extends the
 * fs plugin's scope to whatever the user picks, for the running session.
 */
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, readDir, readFile, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, basename } from "@tauri-apps/api/path";
import type { StorageProvider, GalleryImage, RecentRef, LoadedCharacter } from "./provider";
import { NO_CHARACTER_JSON } from "./provider";
import {
  allocateVersion,
  normalizeVersionTitle,
  parseVersionFilename,
  readVersionTitle,
  requireVersionFilename,
  sortVersionsNewestFirst,
  versionMetadataFilename,
  type VersionStore,
} from "./versions";

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

/** True when running inside the Tauri shell (desktop/mobile), false on the plain web build. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

class TauriFileProvider implements StorageProvider {
  readonly kind = "file";
  constructor(private path: string) {}

  async read(): Promise<unknown> {
    return JSON.parse(await readTextFile(this.path));
  }

  async write(data: unknown): Promise<void> {
    await writeTextFile(this.path, JSON.stringify(data, null, 2));
  }
}

class TauriFolderProvider extends TauriFileProvider {
  readonly versions: VersionStore;

  constructor(characterPath: string, directoryPath: string) {
    super(characterPath);
    this.versions = {
      create: async (data, reason, title, now = new Date()) => {
        const historyPath = await join(directoryPath, "history");
        await mkdir(historyPath, { recursive: true });
        const existing = new Set((await readDir(historyPath)).filter((entry) => entry.isFile).map((entry) => entry.name));
        const version = allocateVersion(now, reason, existing);
        await writeTextFile(await join(historyPath, version.filename), JSON.stringify(data, null, 2));
        const normalizedTitle = normalizeVersionTitle(title);
        if (normalizedTitle) {
          await writeTextFile(
            await join(historyPath, versionMetadataFilename(version.filename)),
            JSON.stringify({ title: normalizedTitle }, null, 2),
          );
        }
        return { ...version, title: normalizedTitle };
      },
      list: async () => {
        const historyPath = await join(directoryPath, "history");
        if (!(await exists(historyPath))) return [];
        const versions = (await readDir(historyPath))
          .filter((entry) => entry.isFile)
          .map((entry) => parseVersionFilename(entry.name))
          .filter((version) => version !== null);
        const titled = await Promise.all(versions.map(async (version) => {
          const metadataPath = await join(historyPath, versionMetadataFilename(version.filename));
          if (!(await exists(metadataPath))) return version;
          try {
            return { ...version, title: readVersionTitle(JSON.parse(await readTextFile(metadataPath))) };
          } catch {
            return version;
          }
        }));
        return sortVersionsNewestFirst(titled);
      },
      read: async (version) => {
        requireVersionFilename(version.filename);
        return JSON.parse(await readTextFile(await join(directoryPath, "history", version.filename)));
      },
      delete: async (version) => {
        requireVersionFilename(version.filename);
        const historyPath = await join(directoryPath, "history");
        await remove(await join(historyPath, version.filename));
        const metadataPath = await join(historyPath, versionMetadataFilename(version.filename));
        if (await exists(metadataPath)) await remove(metadataPath);
      },
    };
  }
}

async function readImagesDirTauri(dirPath: string): Promise<GalleryImage[]> {
  const imagesPath = await join(dirPath, "images");
  if (!(await exists(imagesPath))) return [];
  const entries = await readDir(imagesPath);
  const names = entries
    .filter((e) => e.isFile && IMAGE_RE.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const images: GalleryImage[] = [];
  for (const name of names) {
    const bytes = await readFile(await join(imagesPath, name));
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const blob = new Blob([bytes], { type: MIME[ext] ?? "application/octet-stream" });
    images.push({ name: `images/${name}`, url: URL.createObjectURL(blob) });
  }
  return images;
}

/** Opens a character.json for live read/write via the native file dialog. Null if cancelled. */
export async function openCharacterFileTauri(): Promise<{
  provider: StorageProvider;
  raw: unknown;
  ref: RecentRef;
} | null> {
  const path = await openDialog({
    multiple: false,
    filters: [{ name: "character.json", extensions: ["json"] }],
  });
  if (!path) return null;
  const provider = new TauriFileProvider(path);
  return {
    provider,
    raw: await provider.read(),
    ref: { platform: "tauri", kind: "file", name: await basename(path), path },
  };
}

/**
 * Opens a character *folder* (`character.json` + optional `images/`) via the native folder
 * dialog. Null if cancelled; throws NO_CHARACTER_JSON if the folder has none.
 */
export async function openCharacterFolderTauri(): Promise<{
  provider: StorageProvider;
  raw: unknown;
  images: GalleryImage[];
  sourceName: string;
  ref: RecentRef;
} | null> {
  const dirPath = await openDialog({ directory: true, multiple: false, recursive: true });
  if (!dirPath) return null;
  const jsonPath = await join(dirPath, "character.json");
  if (!(await exists(jsonPath))) throw new Error(NO_CHARACTER_JSON);
  const provider = new TauriFolderProvider(jsonPath, dirPath);
  return {
    provider,
    raw: await provider.read(),
    images: await readImagesDirTauri(dirPath),
    sourceName: await basename(dirPath),
    ref: { platform: "tauri", kind: "folder", name: await basename(dirPath), path: dirPath },
  };
}

/**
 * "Save a copy" via the native Save dialog. Writes the JSON to a user-chosen destination and
 * returns its absolute path, or null if the user cancelled. This is an export (a one-shot copy),
 * independent of any bound source — it never rebinds live-sync.
 */
export async function saveJsonAsTauri(json: string, defaultName: string): Promise<string | null> {
  const ext = defaultName.split(".").pop() || "json";
  const path = await saveDialog({
    defaultPath: defaultName,
    filters: [{ name: defaultName, extensions: [ext] }],
  });
  if (!path) return null;
  await writeTextFile(path, json);
  return path;
}

/** Re-resolve a native RecentRef (stored absolute path) into a live character.
 *  Throws NO_CHARACTER_JSON if the file/folder is gone (moved or deleted). */
export async function reopenTauriPath(ref: RecentRef): Promise<LoadedCharacter> {
  if (ref.kind === "folder") {
    const dirPath = ref.path!;
    const jsonPath = await join(dirPath, "character.json");
    if (!(await exists(jsonPath))) throw new Error(NO_CHARACTER_JSON);
    const provider = new TauriFolderProvider(jsonPath, dirPath);
    return {
      provider,
      raw: await provider.read(),
      images: await readImagesDirTauri(dirPath),
      sourceName: await basename(dirPath),
    };
  }
  const path = ref.path!;
  if (!(await exists(path))) throw new Error(NO_CHARACTER_JSON);
  const provider = new TauriFileProvider(path);
  return { provider, raw: await provider.read(), images: [], sourceName: await basename(path) };
}
