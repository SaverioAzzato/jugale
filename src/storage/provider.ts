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
 * only names the active portrait via `meta.portrait.src`; ordering is filename order here.
 */
export interface GalleryImage {
  /** Path relative to the character folder, e.g. "images/01-portrait.svg". */
  name: string;
  /** A displayable URL for an <img src>. May be a blob: object URL that needs revoking. */
  url: string;
}

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
export async function openCharacterFile(): Promise<{ provider: StorageProvider; raw: unknown } | null> {
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
  const provider = new FileHandleProvider(handles[0]);
  return { provider, raw: await provider.read() };
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
  return { provider, raw: await provider.read(), images: await readImagesDir(dir), sourceName: dir.name };
}

/**
 * Read-only fallback for browsers without live folder access: parse a folder picked via
 * `<input type="file" webkitdirectory>`. Finds the shallowest `character.json` and reads any
 * sibling `images/` files in alphabetical order. Throws NO_CHARACTER_JSON if none is present.
 */
export async function importCharacterFolder(files: FileList | File[]): Promise<{
  raw: unknown;
  images: GalleryImage[];
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
  const images: GalleryImage[] = list
    .filter((f) => {
      const p = rel(f);
      return p.startsWith(imagesPrefix) && !p.slice(imagesPrefix.length).includes("/") && IMAGE_RE.test(p);
    })
    .sort((a, b) => rel(a).localeCompare(rel(b)))
    .map((f) => ({ name: `images/${rel(f).slice(imagesPrefix.length)}`, url: URL.createObjectURL(f) }));

  const sourceName = baseDir.split("/").pop() || jsonFile.name;
  return { raw: JSON.parse(await jsonFile.text()), images, sourceName };
}

/** Fallback load for browsers without live file access: parse a JSON file chosen via <input type="file">. */
export async function importJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
}

/** Fallback save or manual backup: download the current character as a JSON file. */
export function exportJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
