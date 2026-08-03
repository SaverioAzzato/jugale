/**
 * "Recents" list for the welcome screen — the last-opened characters, so the user can
 * reopen with one click. Each entry is a serializable RecentRef (a stored FileSystemHandle
 * on the web, an absolute path on native) plus when it was last opened.
 *
 * Everything is **local-only**: entries live in IndexedDB (handles aren't stringifiable, so
 * localStorage can't hold them), nothing is ever sent anywhere. Chromium/native sources retain
 * their live handle/path/URI; fallback imports retain an explicit read-only snapshot.
 */
import type {
  RecentRef,
  LoadedCharacter,
  GalleryImage,
  SnapshotImage,
  WebDirectoryHandle,
  WebFileHandle,
} from "./provider";
import { reopenWebHandle } from "./provider";
import { isTauri, reopenTauriPath } from "./tauriProvider";
import { isAndroid, reopenAndroid } from "./androidProvider";

interface RecentMetadata {
  /** Stable de-dup key (platform + kind + path/name). */
  key: string;
  lastOpenedAt: number;
}

type WithRecentMetadata<T> = T extends RecentRef ? T & RecentMetadata : never;
export type RecentEntry = WithRecentMetadata<RecentRef>;

/** What a reopen yields: a live (writable) provider, or a read-only snapshot copy. */
export type ReopenResult =
  | ({ mode: "live" } & LoadedCharacter)
  | { mode: "snapshot"; raw: unknown; images: GalleryImage[]; sourceName: string };

const MAX = 8;
const DB_NAME = "jugale";
const STORE = "kv";
const RECENTS_KEY = "recents";

/** Recents work wherever there's IndexedDB: live refs on Chromium/native, read-only
 *  snapshots everywhere else. So support tracks IndexedDB presence alone. */
export function recentsSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

/** A synchronous de-dup key. Web folders with the same name collide (rare); acceptable here. */
export function refKey(ref: RecentRef): string {
  if (ref.platform === "tauri") return `tauri:${ref.kind}:${ref.path}`;
  if (ref.platform === "android") return `android:${ref.kind}:${ref.uri.uri}`;
  if (ref.platform === "snapshot") return `snapshot:${ref.kind}:${ref.name}`;
  return `web:${ref.kind}:${ref.name}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isKind = (value: unknown): value is RecentRef["kind"] => value === "file" || value === "folder";
const isWebFileHandle = (value: unknown): value is WebFileHandle =>
  isRecord(value) && value.kind === "file" && typeof value.name === "string" &&
  typeof value.getFile === "function" && typeof value.createWritable === "function";
const isWebDirectoryHandle = (value: unknown): value is WebDirectoryHandle =>
  isRecord(value) && value.kind === "directory" && typeof value.name === "string" &&
  typeof value.getFileHandle === "function" && typeof value.getDirectoryHandle === "function" &&
  typeof value.removeEntry === "function" && typeof value.entries === "function";

/** Validate structured-cloned IndexedDB data before it reaches host-specific reopen code. */
export function parseRecentEntry(value: unknown): RecentEntry | null {
  if (!isRecord(value) || !isKind(value.kind) || typeof value.name !== "string") return null;
  if (typeof value.key !== "string" || typeof value.lastOpenedAt !== "number" || !Number.isFinite(value.lastOpenedAt)) {
    return null;
  }

  let ref: RecentRef;
  switch (value.platform) {
    case "web":
      if (value.kind === "file") {
        if (!isWebFileHandle(value.handle)) return null;
        ref = { platform: "web", kind: "file", name: value.name, handle: value.handle };
      } else {
        if (!isWebDirectoryHandle(value.handle)) return null;
        ref = { platform: "web", kind: "folder", name: value.name, handle: value.handle };
      }
      break;
    case "tauri":
      if (typeof value.path !== "string" || value.path.length === 0) return null;
      ref = { platform: "tauri", kind: value.kind, name: value.name, path: value.path };
      break;
    case "android":
      if (!isRecord(value.uri) || typeof value.uri.uri !== "string") return null;
      if (value.uri.documentTopTreeUri !== null && typeof value.uri.documentTopTreeUri !== "string") return null;
      ref = {
        platform: "android",
        kind: value.kind,
        name: value.name,
        uri: { uri: value.uri.uri, documentTopTreeUri: value.uri.documentTopTreeUri },
      };
      break;
    case "snapshot": {
      if (!("raw" in value) || !Array.isArray(value.images)) return null;
      const images = value.images.filter((image): image is SnapshotImage =>
        isRecord(image) && typeof image.name === "string" && image.blob instanceof Blob);
      if (images.length !== value.images.length) return null;
      ref = { platform: "snapshot", kind: value.kind, name: value.name, raw: value.raw, images };
      break;
    }
    default:
      return null;
  }

  if (value.key !== refKey(ref)) return null;
  return { ...ref, key: value.key, lastOpenedAt: value.lastOpenedAt } as RecentEntry;
}

export function parseRecentEntries(value: unknown): RecentEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseRecentEntry).filter((entry): entry is RecentEntry => entry !== null);
}

/** Whether a stored entry can be re-resolved on the current host: a tauri path is useless in a
 *  browser, a web handle in the native shell, an Android SAF URI anywhere but Android; a snapshot
 *  works anywhere. Android is a Tauri host too, so it's checked before the desktop-Tauri case. */
function resolvableHere(e: RecentEntry): boolean {
  if (e.platform === "snapshot") return true;
  if (isAndroid()) return e.platform === "android";
  if (isTauri()) return e.platform === "tauri";
  return e.platform === "web";
}

/** Pure: insert/refresh `entry`, drop any same-key duplicate, newest first, capped at `max`. */
export function mergeRecent(list: RecentEntry[], entry: RecentEntry, max = MAX): RecentEntry[] {
  const without = list.filter((e) => e.key !== entry.key);
  return [entry, ...without].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, max);
}

// ---- IndexedDB key-value (minimal, dependency-free) ----

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const readAll = async (): Promise<RecentEntry[]> => {
  const stored = await idbGet<unknown>(RECENTS_KEY);
  return parseRecentEntries(stored);
};

/** Recents re-resolvable on this host, newest first. Returns [] if unsupported or on any error. */
export async function listRecents(): Promise<RecentEntry[]> {
  if (!recentsSupported()) return [];
  try {
    const all = await readAll();
    return all.filter(resolvableHere).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  } catch {
    return [];
  }
}

/** Record (or bump) a just-opened character. No-op on platforms that can't re-resolve. */
export async function recordRecent(ref: RecentRef): Promise<void> {
  if (!recentsSupported()) return;
  try {
    const entry: RecentEntry = { ...ref, key: refKey(ref), lastOpenedAt: Date.now() };
    await idbSet(RECENTS_KEY, mergeRecent(await readAll(), entry));
  } catch {
    // a failed recents write must never block opening a character
  }
}

/** Drop a single entry (e.g. a stale one whose file moved/was deleted). */
export async function removeRecent(key: string): Promise<void> {
  try {
    await idbSet(RECENTS_KEY, (await readAll()).filter((e) => e.key !== key));
  } catch {
    /* ignore */
  }
}

/** Clear every recent (a browser/app only ever sees its own local list). */
export async function clearRecents(): Promise<void> {
  try {
    await idbSet(RECENTS_KEY, []);
  } catch {
    /* ignore */
  }
}

/** Re-resolve a recent: live (writable) for handle/path entries, read-only for snapshots.
 *  Throws (NO_CHARACTER_JSON / permission denied) for live entries that can't be reopened. */
export async function reopenRecent(entry: RecentEntry): Promise<ReopenResult> {
  if (entry.platform === "snapshot") {
    const images: GalleryImage[] = (entry.images ?? []).map((im) => ({
      name: im.name,
      url: URL.createObjectURL(im.blob),
    }));
    return { mode: "snapshot", raw: entry.raw, images, sourceName: entry.name };
  }
  const loaded =
    entry.platform === "android"
      ? await reopenAndroid(entry)
      : entry.platform === "tauri"
        ? await reopenTauriPath(entry)
        : await reopenWebHandle(entry);
  return { mode: "live", ...loaded };
}
