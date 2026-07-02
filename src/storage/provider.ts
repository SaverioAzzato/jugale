/**
 * Host-agnostic persistence. M1.2 ships the browser File System Access path plus
 * a JSON import/export fallback for browsers that cannot keep a writable file handle;
 * M4 adds folder-aware loading (`character.json` + `images/`) over the same surface,
 * with the Tauri `fs` implementation landing with the native shells. Everything above
 * this layer talks only to `StorageProvider`.
 */
export interface StorageProvider {
  readonly kind: "file";
  read(): Promise<unknown>;
  write(data: unknown): Promise<void>;
}

/**
 * A runtime image from a character's `images/` folder. The blob `url` is host-supplied
 * (object URL on the web, asset URL for bundled samples) and never persisted — the JSON
 * carries no image references at all; images are ordered by filename and the first is the
 * portrait, so the user specifies nothing.
 */
export interface GalleryImage {
  /** Path relative to the character folder, e.g. "images/01-portrait.svg". */
  name: string;
  /** A displayable URL for an <img src>. May be a blob: object URL that needs revoking. */
  url: string;
}

/** An image kept inside a read-only snapshot: the blob is structured-cloneable (IndexedDB). */
export interface SnapshotImage {
  name: string;
  blob: Blob;
}

/**
 * A serializable reference to a previously-opened character, persisted for the "Recents"
 * list. Four flavours, one per host capability:
 * - `web`: a live `FileSystemHandle` (Chromium) — reopens writable.
 * - `tauri`: an absolute `path` (desktop) — reopens writable.
 * - `android`: a SAF `content://` URI with a persisted read+write grant — reopens writable in place.
 * - `snapshot`: an inlined read-only copy (`raw` + image blobs) for hosts that can't persist a
 *   live reference (Firefox/Safari, or any plain JSON/folder import) — reopens read-only.
 * All structured-cloneable, kept in IndexedDB; nothing is ever sent anywhere.
 */
export interface RecentRef {
  platform: "web" | "tauri" | "android" | "snapshot";
  kind: "file" | "folder";
  name: string;
  path?: string; // tauri
  handle?: unknown; // web: FileSystemFileHandle | directory handle (cast on reopen)
  uri?: unknown; // android: AndroidFsUri (cast on reopen); tree URI for folders, file URI for files
  raw?: unknown; // snapshot: the character JSON
  images?: SnapshotImage[]; // snapshot: gallery blobs
}

/** A character re-resolved from a RecentRef or a fresh pick: ready to hand to the store. */
export interface LoadedCharacter {
  provider: StorageProvider;
  raw: unknown;
  images: GalleryImage[];
  sourceName: string;
}

/** Thrown by reopenWebHandle when the user declines the browser's re-permission prompt. */
export const RECENT_PERMISSION_DENIED = "recent-permission-denied";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** Async-iterable directory handle (File System Access API; not yet in every TS lib). */
interface DirHandle {
  name: string;
  getFileHandle(name: string): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string): Promise<DirHandle>;
  entries(): AsyncIterable<[string, { kind: "file" | "directory" }]>;
}

type PickerWindow = Window & {
  showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
  showDirectoryPicker?: (opts?: unknown) => Promise<DirHandle>;
};

/** True when the browser can read/write a real file (Chromium today). */
export function isFileAccessSupported(): boolean {
  return typeof (window as PickerWindow).showOpenFilePicker === "function";
}

/** True when the browser can open a live, writable folder (Chromium today). */
export function isDirectoryAccessSupported(): boolean {
  return typeof (window as PickerWindow).showDirectoryPicker === "function";
}

class FileHandleProvider implements StorageProvider {
  readonly kind = "file";
  constructor(private handle: FileSystemFileHandle) {}

  async read(): Promise<unknown> {
    const file = await this.handle.getFile();
    return JSON.parse(await file.text());
  }

  async write(data: unknown): Promise<void> {
    const writable = await this.handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  }
}

/** Opens a character.json for live read/write. Returns null if unsupported or cancelled. */
export async function openCharacterFile(): Promise<{
  provider: StorageProvider;
  raw: unknown;
  ref: RecentRef;
} | null> {
  const picker = (window as PickerWindow).showOpenFilePicker;
  if (!picker) return null;
  let handles: FileSystemFileHandle[];
  try {
    handles = await picker({
      types: [{ description: "character.json", accept: { "application/json": [".json"] } }],
    });
  } catch {
    return null; // user dismissed the picker
  }
  const handle = handles[0];
  const provider = new FileHandleProvider(handle);
  return {
    provider,
    raw: await provider.read(),
    ref: { platform: "web", kind: "file", name: handle.name, handle },
  };
}

/** Thrown by the folder loaders when the chosen folder has no character.json at its root. */
export const NO_CHARACTER_JSON = "no-character-json";

/** Read images from a File System Access `images/` subfolder, alphabetical by filename. */
async function readImagesDir(dir: DirHandle): Promise<GalleryImage[]> {
  const images: GalleryImage[] = [];
  let imagesDir: DirHandle;
  try {
    imagesDir = await dir.getDirectoryHandle("images");
  } catch {
    return images; // no images/ folder is fine
  }
  const names: string[] = [];
  for await (const [name, handle] of imagesDir.entries()) {
    if (handle.kind === "file" && IMAGE_RE.test(name)) names.push(name);
  }
  names.sort((a, b) => a.localeCompare(b));
  for (const name of names) {
    const file = await (await imagesDir.getFileHandle(name)).getFile();
    images.push({ name: `images/${name}`, url: URL.createObjectURL(file) });
  }
  return images;
}

/**
 * Opens a character *folder* (`character.json` + optional `images/`) for live read/write.
 * Returns null if unsupported or cancelled; throws NO_CHARACTER_JSON if the folder has none.
 */
export async function openCharacterFolder(): Promise<{
  provider: StorageProvider;
  raw: unknown;
  images: GalleryImage[];
  sourceName: string;
  ref: RecentRef;
} | null> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return null;
  let dir: DirHandle;
  try {
    dir = await picker({ mode: "readwrite" });
  } catch {
    return null; // user dismissed the picker
  }
  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await dir.getFileHandle("character.json");
  } catch {
    throw new Error(NO_CHARACTER_JSON);
  }
  const provider = new FileHandleProvider(fileHandle);
  return {
    provider,
    raw: await provider.read(),
    images: await readImagesDir(dir),
    sourceName: dir.name,
    ref: { platform: "web", kind: "folder", name: dir.name, handle: dir },
  };
}

/**
 * Read-only fallback for browsers without live folder access: parse a folder picked via
 * `<input type="file" webkitdirectory>`. Finds the shallowest `character.json` and reads any
 * sibling `images/` files in alphabetical order. Throws NO_CHARACTER_JSON if none is present.
 */
export async function importCharacterFolder(files: FileList | File[]): Promise<{
  raw: unknown;
  images: GalleryImage[];
  /** The same images as persistable blobs, for a Recents snapshot. */
  imageBlobs: SnapshotImage[];
  sourceName: string;
}> {
  const list = Array.from(files);
  const rel = (f: File) => f.webkitRelativePath || f.name;
  // Shallowest character.json wins (fewest path segments), so a nested copy can't shadow the root.
  const jsonFiles = list
    .filter((f) => rel(f).split("/").pop() === "character.json")
    .sort((a, b) => rel(a).split("/").length - rel(b).split("/").length);
  const jsonFile = jsonFiles[0];
  if (!jsonFile) throw new Error(NO_CHARACTER_JSON);

  const baseDir = rel(jsonFile).split("/").slice(0, -1).join("/"); // folder holding character.json
  const imagesPrefix = baseDir ? `${baseDir}/images/` : "images/";
  const imageFiles = list
    .filter((f) => {
      const p = rel(f);
      return p.startsWith(imagesPrefix) && !p.slice(imagesPrefix.length).includes("/") && IMAGE_RE.test(p);
    })
    .sort((a, b) => rel(a).localeCompare(rel(b)));
  const images: GalleryImage[] = imageFiles.map((f) => ({
    name: `images/${rel(f).slice(imagesPrefix.length)}`,
    url: URL.createObjectURL(f),
  }));
  const imageBlobs: SnapshotImage[] = imageFiles.map((f) => ({
    name: `images/${rel(f).slice(imagesPrefix.length)}`,
    blob: f,
  }));

  const sourceName = baseDir.split("/").pop() || jsonFile.name;
  return { raw: JSON.parse(await jsonFile.text()), images, imageBlobs, sourceName };
}

/** Fallback load for browsers without live file access: parse a JSON file chosen via <input type="file">. */
export async function importJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
}

/** Route pre-serialized text to the browser's downloads location via an <a download> blob.
 *  The browser never tells us where it landed (usually the Downloads folder). */
function downloadText(text: string, filename: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Fallback save or manual backup: download an object as a pretty-printed JSON file. */
export function exportJson(data: unknown, filename: string): void {
  downloadText(JSON.stringify(data, null, 2), filename);
}

/** A window that may expose the File System Access save picker (Chromium today). */
type SaveWindow = Window & {
  showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
};

/** True when the browser can offer a native "Save as…" picker (Chromium today). */
export function isSavePickerSupported(): boolean {
  return typeof (window as SaveWindow).showSaveFilePicker === "function";
}

/**
 * Save a copy of the character JSON to a browser-chosen destination. On Chromium the File
 * System Access save picker returns a writable handle, so we can report the *filename* the user
 * chose — never the absolute path, which the browser hides for privacy (`picked: true`).
 * Elsewhere (Firefox/Safari) we fall back to an <a download> blob, routed to the browser's
 * downloads location without telling us where (`picked: false`). Returns null if the user
 * dismisses the save picker.
 */
export async function saveCharacterAsWeb(
  json: string,
  defaultName: string,
): Promise<{ name: string; picked: boolean } | null> {
  const picker = (window as SaveWindow).showSaveFilePicker;
  if (picker) {
    let handle: FileSystemFileHandle;
    try {
      handle = await picker({
        suggestedName: defaultName,
        types: [{ description: "character.json", accept: { "application/json": [".json"] } }],
      });
    } catch {
      return null; // user dismissed the Save picker (AbortError)
    }
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    return { name: handle.name, picked: true };
  }
  downloadText(json, defaultName);
  return { name: defaultName, picked: false };
}

/** A persisted FileSystemHandle with the permission methods TS's lib doesn't always type. */
interface PermHandle {
  queryPermission?(d: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(d: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

/** Regain read/write access to a stored handle, prompting once if needed (needs a user gesture,
 *  which the click on a recent provides). Throws RECENT_PERMISSION_DENIED if the user declines. */
async function ensurePermission(handle: unknown): Promise<void> {
  const h = handle as PermHandle;
  const opts = { mode: "readwrite" as const };
  if (!h.queryPermission) return; // older impl without the permission API: assume usable
  if ((await h.queryPermission(opts)) === "granted") return;
  if ((await h.requestPermission?.(opts)) === "granted") return;
  throw new Error(RECENT_PERMISSION_DENIED);
}

/** Re-resolve a web RecentRef (stored FileSystemHandle) into a live, writable character.
 *  Throws RECENT_PERMISSION_DENIED if access is declined, NO_CHARACTER_JSON if the folder's
 *  character.json is gone. */
export async function reopenWebHandle(ref: RecentRef): Promise<LoadedCharacter> {
  await ensurePermission(ref.handle);
  if (ref.kind === "folder") {
    const dir = ref.handle as DirHandle;
    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await dir.getFileHandle("character.json");
    } catch {
      throw new Error(NO_CHARACTER_JSON);
    }
    const provider = new FileHandleProvider(fileHandle);
    return { provider, raw: await provider.read(), images: await readImagesDir(dir), sourceName: dir.name };
  }
  const provider = new FileHandleProvider(ref.handle as FileSystemFileHandle);
  return { provider, raw: await provider.read(), images: [], sourceName: ref.name };
}
