/**
 * Host-agnostic persistence. M1.2 ships the browser File System Access path plus
 * a JSON import/export fallback for browsers that cannot keep a writable file handle;
 * the Tauri `fs` implementation lands with the native shells (M4). Everything above
 * this layer talks only to `StorageProvider`.
 */
export interface StorageProvider {
  readonly kind: "file";
  read(): Promise<unknown>;
  write(data: unknown): Promise<void>;
}

type PickerWindow = Window & {
  showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
};

/** True when the browser can read/write a real file (Chromium today). */
export function isFileAccessSupported(): boolean {
  return typeof (window as PickerWindow).showOpenFilePicker === "function";
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
