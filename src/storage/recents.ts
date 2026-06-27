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
import type { RecentRef, LoadedCharacter } from "./provider";
import { reopenWebHandle, isFileAccessSupported } from "./provider";
import { isTauri, reopenTauriPath } from "./tauriProvider";

export interface RecentEntry extends RecentRef {
  /** Stable de-dup key (platform + kind + path/name). */
  key: string;
  lastOpenedAt: number;
}

const MAX = 8;
const DB_NAME = "jugale";
const STORE = "kv";
const RECENTS_KEY = "recents";

/** True when this platform can both persist and re-resolve a reference. */
export function recentsSupported(): boolean {
  if (typeof indexedDB === "undefined") return false;
  return isTauri() || isFileAccessSupported();
}

/** A synchronous de-dup key. Web folders with the same name collide (rare); acceptable here. */
export function refKey(ref: RecentRef): string {
  return ref.platform === "tauri" ? `tauri:${ref.kind}:${ref.path}` : `web:${ref.kind}:${ref.name}`;
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
const platformNow = (): RecentRef["platform"] => (isTauri() ? "tauri" : "web");

/** Recents for the current platform, newest first. Returns [] if unsupported or on any error. */
export async function listRecents(): Promise<RecentEntry[]> {
  if (!recentsSupported()) return [];
  try {
    const all = await readAll();
    return all.filter((e) => e.platform === platformNow()).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
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

/** Clear the current platform's recents (leaves other platforms' entries untouched). */
export async function clearRecents(): Promise<void> {
  try {
    await idbSet(RECENTS_KEY, (await readAll()).filter((e) => e.platform !== platformNow()));
  } catch {
    /* ignore */
  }
}

/** Re-resolve a recent into a live character. Throws (NO_CHARACTER_JSON / permission denied). */
export function reopenRecent(entry: RecentEntry): Promise<LoadedCharacter> {
  return entry.platform === "tauri" ? reopenTauriPath(entry) : reopenWebHandle(entry);
}
