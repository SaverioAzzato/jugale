/**
 * IndexedDB and file system persistence
 */

const DB_NAME = "character-platform";
const DB_VERSION = 2;
const STORE_HANDLES = "handles";
const CURRENT_HANDLE_KEY = "character-json";

function openDbOnce() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_HANDLES)) {
        req.result.createObjectStore(STORE_HANDLES);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteDb() {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

export async function openDb() {
  try {
    return await openDbOnce();
  } catch (error) {
    console.warn("IndexedDB open failed, resetting database.", error);
    await deleteDb();
    return openDbOnce();
  }
}

export async function saveHandle(handle) {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HANDLES, "readwrite");
      tx.objectStore(STORE_HANDLES).put(handle, CURRENT_HANDLE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("Could not persist current handle.", error);
  }
}

export async function loadHandle() {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const req = db
        .transaction(STORE_HANDLES)
        .objectStore(STORE_HANDLES)
        .get(CURRENT_HANDLE_KEY);
      req.onsuccess = () => {
        const value = req.result;
        resolve(typeof value === "string" ? value : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (error) {
    console.warn("Could not load current handle.", error);
    return null;
  }
}

export async function resolveCharacterFileHandle(handle) {
  if (!handle) {
    return null;
  }

  if (handle.kind === "file") {
    return handle;
  }

  if (typeof handle.getFileHandle === "function") {
    return handle.getFileHandle("character.json");
  }

  return null;
}

export async function requestReadWritePermission(handle) {
  if (!handle || typeof handle.requestPermission !== "function") {
    throw new Error("Handle non valido.");
  }

  const current =
    typeof handle.queryPermission === "function"
      ? await handle.queryPermission({ mode: "readwrite" })
      : "prompt";

  if (current === "granted") {
    return;
  }

  const requested = await handle.requestPermission({ mode: "readwrite" });
  if (requested !== "granted") {
    const error = new Error("Permesso in scrittura negato.");
    error.code = "PERMISSION_DENIED";
    throw error;
  }
}

export async function loadCharacterFromFile(fileHandle) {
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}

export async function saveCharacterToFile(fileHandle, data) {
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}
