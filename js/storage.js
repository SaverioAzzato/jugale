/**
 * IndexedDB and file system persistence
 */

import { state } from "./state.js";

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("character-platform", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, "character-json");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadHandle() {
  const db = await openDb();
  return new Promise((resolve) => {
    const req = db
      .transaction("handles")
      .objectStore("handles")
      .get("character-json");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
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
  const permission = await handle.requestPermission({
    mode: "readwrite",
  });
  if (permission !== "granted") throw new Error("Permesso negato.");
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
