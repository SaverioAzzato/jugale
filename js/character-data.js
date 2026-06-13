/**
 * Character data loading, saving, and sync
 */

import { state, elements } from "./state.js";
import {
  loadHandle,
  saveHandle,
  requestReadWritePermission,
} from "./storage.js";
import {
  prepareImageManifest,
  revokeImageObjectUrls,
} from "./image-handler.js";
import { renderCharacter } from "./render.js";
import { updateDataFromForm } from "./session.js";

// Will be injected by main
let setSyncStatus = null;
let renderSessionSummary = null;

export function initCharacterData(setSyncStatusFn, renderSessionSummaryFn) {
  setSyncStatus = setSyncStatusFn;
  renderSessionSummary = renderSessionSummaryFn;
}

export async function saveToHandle() {
  if (!state.fileHandle || !state.character) {
    throw new Error("Nessun file handle live disponibile.");
  }

  state.character.session.lastSavedAt = new Date().toISOString();
  const writable = await state.fileHandle.createWritable();
  await writable.write(JSON.stringify(state.character, null, 2));
  await writable.close();
  state.dirty = false;
  elements.sourceData.textContent = JSON.stringify(state.character, null, 2);
  setSyncStatus(
    `Sync live attivo · ultimo salvataggio ${new Date(state.character.session.lastSavedAt).toLocaleTimeString("it-IT")}`,
    "ok",
  );
}

export function scheduleSave(reason) {
  if (!state.character) {
    return;
  }

  updateDataFromForm();
  renderSessionSummary();
  elements.sourceData.textContent = JSON.stringify(state.character, null, 2);
  state.dirty = true;

  if (!state.liveSync || !state.fileHandle) {
    setSyncStatus(
      `JSON caricato senza sync live · modifica locale: ${reason}`,
      "warn",
    );
    return;
  }

  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    saveToHandle().catch((error) => {
      console.error(error);
      setSyncStatus(`Errore di sync: ${error.message}`, "warn");
    });
  }, 250);
}

export async function loadCharacterData(data, options = {}) {
  state.character = data;
  state.fileHandle = options.fileHandle || null;
  state.sourceHandle = options.sourceHandle || options.fileHandle || null;
  state.liveSync = Boolean(options.liveSync && options.fileHandle);
  await prepareImageManifest(data);
  state.activeImagePath =
    data.meta?.portrait?.src || state.imageManifest[0]?.src || null;
  if (state.sourceHandle) {
    await saveHandle(state.sourceHandle);
  }
  renderCharacter();
  if (state.liveSync) {
    setSyncStatus("Sync live attivo", "ok");
  } else {
    setSyncStatus("In sola lettura", "warn");
  }
}

export async function connectJson() {
  try {
    const handle = await window.showDirectoryPicker({
      mode: "readwrite",
    });
    console.log("Directory picked.");
    await requestReadWritePermission(handle);
    let fileHandle;
    try {
      fileHandle = await handle.getFileHandle("character.json");
    } catch (error) {
      if (error?.name === "NotFoundError") {
        throw new Error("La cartella scelta non contiene character.json.");
      }
      throw error;
    }
    await requestReadWritePermission(fileHandle);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);
    console.log("Character JSON parsed.");
    await loadCharacterData(parsed, {
      fileHandle,
      sourceHandle: handle,
      liveSync: true,
    });
  } catch (error) {
    setSyncStatus(`Errore di connessione: ${error.message}`, "warn");
    throw error;
  }
}

export async function tryAutoLoad() {
  try {
    const savedHandle = await loadHandle();
    if (savedHandle) {
      console.log("Attempting to restore saved handle...");
      const fileHandle = await savedHandle.getFileHandle("character.json");
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      console.log("Auto-loaded character data.");
      await loadCharacterData(parsed, {
        fileHandle,
        sourceHandle: savedHandle,
        liveSync: true,
      });
    }
  } catch (error) {
    console.warn("Could not auto-load:", error.message);
    setSyncStatus("Pronto per aprire un personaggio", "warn");
  }
}

export function exportCopy() {
  if (!state.character) {
    alert("Nessun personaggio caricato.");
    return;
  }
  const blob = new Blob([JSON.stringify(state.character, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), {
    href: url,
    download: "character.json",
  }).click();
  URL.revokeObjectURL(url);
}

export async function reconnectJson() {
  revokeImageObjectUrls();
  state.character = null;
  state.fileHandle = null;
  state.sourceHandle = null;
  state.imageManifest = [];
  state.activeImagePath = null;
  renderCharacter();
  try {
    await connectJson();
  } catch (error) {
    console.error(error);
    setSyncStatus(`Connessione fallita: ${error.message}`, "warn");
  }
}
