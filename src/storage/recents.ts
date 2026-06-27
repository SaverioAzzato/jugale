/**
 * "Recents" list for the welcome screen — the last-opened characters, so the user can
 * reopen with one click. Each entry is a serializable RecentRef (a stored FileSystemHandle
 * on the web, an absolute path on native) plus when it was last opened.
 *
 * Everything is **local-only**: entries live in IndexedDB (handles aren't stringifiable, so
 * localStorage can't hold them), nothing is ever sent anywhere. Only providers that can
 * re-resolve are recorded — Chromium browsers (handles) and the native shells (paths). The
 * read-only import fallback (Firefox/Safari, plain JSON drops) has no re-openable reference,
 * so it isn't tracked.
 */
import type { RecentRef, LoadedCharacter, GalleryImage } from "./provider";
import { reopenWebHandle } from "./provider";
import { isTauri, reopenTauriPath } from "./tauriProvider";

export interface RecentEntry extends RecentRef {
  /** Stable de-dup key (platform + kind + path/name). */
  key: string;
  lastOpenedAt: number;
}

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
  if (ref.platform === "snapshot") return `snapshot:${ref.kind}:${ref.name}`;
  return `web:${ref.kind}:${ref.name}`;
}

/** Whether a stored entry can be re-resolved on the current host (a tauri path is useless in
 *  a browser; a web handle is useless in the native shell; a snapshot works anywhere). */
function resolvableHere(e: RecentEntry): boolean {
  if (e.platform === "snapshot") return true;
  return isTauri() ? e.platform === "tauri" : e.platform === "web";
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

const readAll = async (): Promise<RecentEntry[]> => (await idbGet<RecentEntry[]>(RECENTS_KEY)) ?? [];

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
  const loaded = entry.platform === "tauri" ? await reopenTauriPath(entry) : await reopenWebHandle(entry);
  return { mode: "live", ...loaded };
}
