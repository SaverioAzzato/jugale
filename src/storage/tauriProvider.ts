/**
 * Native (Tauri 2) implementation of the same `StorageProvider` surface the browser File
 * System Access path offers — desktop/mobile shells always have live read/write, so there's
 * no read-only or import/export fallback here. The dialog plugin's open() call extends the
 * fs plugin's scope to whatever the user picks, for the running session.
 */
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, readDir, readFile, readTextFile, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, basename } from "@tauri-apps/api/path";
import type { StorageProvider, GalleryImage, TauriRecentRef, LoadedCharacter, CharacterImportTarget } from "./provider";
import type { PersistableCharacterDocument } from "../schema/validate";
import { normalizeStorageError, storageError } from "./errors";
import { createVersionStore, type VersionStore } from "./versions";

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

let atomicWriteSequence = 0;

/** Same-directory temp + rename: canonical desktop writes never expose a partial JSON file. */
async function atomicWriteText(path: string, contents: string): Promise<void> {
  const temporaryPath = `${path}.jugale-${Date.now()}-${++atomicWriteSequence}.tmp`;
  try {
    await writeTextFile(temporaryPath, contents);
    await rename(temporaryPath, path);
  } catch (error) {
    try {
      if (await exists(temporaryPath)) await remove(temporaryPath);
    } catch {
      // Preserve the original write/rename error; stale temp cleanup is secondary.
    }
    throw error;
  }
}

/** True when running inside the Tauri shell (desktop/mobile), false on the plain web build. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

class TauriFileProvider implements StorageProvider {
  readonly kind = "file";
  constructor(private path: string, private atomic = false) {}

  async read(): Promise<unknown> {
    let text: string;
    try {
      text = await readTextFile(this.path);
    } catch (error) {
      throw normalizeStorageError(error);
    }
    return JSON.parse(text);
  }

  async write(data: PersistableCharacterDocument): Promise<void> {
    try {
      const contents = JSON.stringify(data.document, null, 2);
      if (this.atomic) await atomicWriteText(this.path, contents);
      else await writeTextFile(this.path, contents);
    } catch (error) {
      throw normalizeStorageError(error);
    }
  }
}

class TauriFolderProvider extends TauriFileProvider {
  readonly versions: VersionStore;

  constructor(characterPath: string, directoryPath: string) {
    super(characterPath, true);
    const historyPath = async () => join(directoryPath, "history");
    this.versions = createVersionStore({
      listNames: async () => {
        const path = await historyPath();
        if (!(await exists(path))) return [];
        return (await readDir(path)).filter((entry) => entry.isFile).map((entry) => entry.name);
      },
      writeText: async (filename, contents) => {
        const path = await historyPath();
        await mkdir(path, { recursive: true });
        await atomicWriteText(await join(path, filename), contents);
      },
      readText: async (filename) => readTextFile(await join(await historyPath(), filename)),
      remove: async (filename) => {
        const path = await join(await historyPath(), filename);
        if (!(await exists(path))) throw storageError("not-found", undefined, `Missing history/${filename}`);
        await remove(path);
      },
    });
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
  ref: TauriRecentRef;
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
  ref: TauriRecentRef;
} | null> {
  const dirPath = await openDialog({ directory: true, multiple: false, recursive: true });
  if (!dirPath) return null;
  const jsonPath = await join(dirPath, "character.json");
  if (!(await exists(jsonPath))) throw storageError("no-character-json");
  const provider = new TauriFolderProvider(jsonPath, dirPath);
  return {
    provider,
    raw: await provider.read(),
    images: await readImagesDirTauri(dirPath),
    sourceName: await basename(dirPath),
    ref: { platform: "tauri", kind: "folder", name: await basename(dirPath), path: dirPath },
  };
}

/** Choose a desktop folder as an import destination without changing it. */
export async function pickCharacterImportTargetTauri(): Promise<CharacterImportTarget | null> {
  const dirPath = await openDialog({ directory: true, multiple: false, recursive: true });
  if (!dirPath) return null;
  const entries = await readDir(dirPath);
  const sourceName = await basename(dirPath);
  const ref: TauriRecentRef = { platform: "tauri", kind: "folder", name: sourceName, path: dirPath };
  const jsonPath = await join(dirPath, "character.json");
  if (entries.some((entry) => entry.isFile && entry.name === "character.json")) {
    const provider = new TauriFolderProvider(jsonPath, dirPath);
    return {
      kind: "existing",
      provider,
      raw: await provider.read(),
      images: await readImagesDirTauri(dirPath),
      sourceName,
      ref,
    };
  }
  if (entries.length > 0) throw storageError("import-target-not-empty");
  return {
    kind: "empty",
    sourceName,
    ref,
    create: async (document) => {
      const provider = new TauriFolderProvider(jsonPath, dirPath);
      await provider.write(document);
      return { provider, raw: await provider.read(), images: [], sourceName };
    },
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
export async function reopenTauriPath(ref: TauriRecentRef): Promise<LoadedCharacter> {
  if (ref.kind === "folder") {
    const dirPath = ref.path;
    const jsonPath = await join(dirPath, "character.json");
    if (!(await exists(jsonPath))) throw storageError("not-found", undefined, `Missing ${jsonPath}`);
    const provider = new TauriFolderProvider(jsonPath, dirPath);
    return {
      provider,
      raw: await provider.read(),
      images: await readImagesDirTauri(dirPath),
      sourceName: await basename(dirPath),
    };
  }
  const path = ref.path;
  if (!(await exists(path))) throw storageError("not-found", undefined, `Missing ${path}`);
  const provider = new TauriFileProvider(path);
  return { provider, raw: await provider.read(), images: [], sourceName: await basename(path) };
}
