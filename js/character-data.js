/**
 * Character data loading, saving, and sync
 */

import { state, elements } from "./state.js";
import {
  loadHandle,
  saveHandle,
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

function formatRecentDate(value) {
  if (!value) {
    return "Usato di recente";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Usato di recente";
  }

  return `Ultimo uso: ${date.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  })}`;
}

function renderRecentDirectories() {
  if (!elements.setupRecent || !elements.setupRecentList || !elements.setupRecentEmpty) {
    return;
  }

  const hasRecent = state.recentDirectories.length > 0;
  elements.setupRecent.hidden = !hasRecent;
  elements.setupRecentEmpty.hidden = hasRecent;
  elements.setupRecentList.innerHTML = "";

  state.recentDirectories.forEach((item, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    const label = document.createElement("span");
    const date = document.createElement("small");

    button.type = "button";
    button.className = "setup-recent-btn";
    button.dataset.recentIndex = String(index);
    button.title = `Apri ${item.name}`;

    label.className = "setup-recent-name";
    label.textContent = item.name || item.path;

    date.className = "setup-recent-date";
    date.textContent = formatRecentDate(item.lastUsedAt);

    button.append(label, date);
    li.appendChild(button);
    elements.setupRecentList.appendChild(li);
  });
}

export async function refreshRecentDirectories() {
  try {
    const items = await window.electronAPI.getRecentDirectories();
    state.recentDirectories = Array.isArray(items) ? items : [];
  } catch {
    state.recentDirectories = [];
  }
  renderRecentDirectories();
}

function isContextPermissionError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "NotAllowedError" ||
    error?.name === "SecurityError" ||
    message.includes("not allowed by the user agent") ||
    message.includes("current context")
  );
}

function isPickerAbort(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "AbortError" || message.includes("user aborted");
}

function buildWritePermissionError(error) {
  const name = error?.name || "Error";
  const detail = error?.message || "Motivo non disponibile.";
  const lower = `${name} ${detail}`.toLowerCase();

  if (lower.includes("notallowed") || lower.includes("user agent")) {
    return (
      "Scrittura bloccata dal contesto Chromium/Electron. " +
      "Riprova da click utente diretto e evita cartelle sensibili. " +
      `Dettaglio: ${name}: ${detail}`
    );
  }

  if (lower.includes("eperm") || lower.includes("eacces") || lower.includes("operation not permitted")) {
    return (
      "Scrittura negata dal sistema operativo (permessi filesystem). " +
      "Su macOS verifica privacy/permessi per Terminal o Electron e usa una cartella non protetta. " +
      `Dettaglio: ${name}: ${detail}`
    );
  }

  return (
    "Permesso scrittura obbligatorio: consenti l'accesso in scrittura per aprire il personaggio. " +
    `Dettaglio: ${name}: ${detail}`
  );
}

async function loadCharacterFromDirectoryPath(directoryPath) {
  try {
    const payload = await window.electronAPI.loadCharacterFromDirectory(
      directoryPath,
    );
    await openCharacterPayload(payload);
  } catch (error) {
    throw new Error(buildWritePermissionError(error));
  }
}

export async function openCharacterPayload(payload) {
  if (!payload?.directoryPath || !payload?.character) {
    throw new Error("Payload personaggio non valido.");
  }

  await loadCharacterData(payload.character, {
    fileHandle: payload.directoryPath,
    sourceHandle: payload.directoryPath,
    liveSync: true,
    imageManifest: payload.images,
  });
  await refreshRecentDirectories();
}

export async function saveToHandle() {
  if (!state.fileHandle || !state.character) {
    throw new Error("Nessun file handle live disponibile.");
  }

  state.character.session.lastSavedAt = new Date().toISOString();
  await window.electronAPI.saveCharacterToDirectory(
    state.sourceHandle,
    state.character,
  );
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
      `Nessun file collegato in scrittura · modifica locale: ${reason}`,
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
  await prepareImageManifest(data, options.imageManifest || []);
  state.activeImagePath =
    data.meta?.portrait?.src || state.imageManifest[0]?.src || null;
  if (state.sourceHandle) {
    await saveHandle(state.sourceHandle);
  }
  renderCharacter();
  if (state.liveSync) {
    setSyncStatus("Sync live attivo", "ok");
  } else {
    setSyncStatus("Nessun sync attivo", "warn");
  }
}

export async function connectJson() {
  try {
    const payload = await window.electronAPI.pickCharacterDirectory();
    if (payload?.canceled) {
      return false;
    }

    await openCharacterPayload(payload);
  } catch (error) {
    if (isPickerAbort(error)) {
      return false;
    }
    setSyncStatus(`Errore di connessione: ${error.message}`, "warn");
    throw error;
  }

  return true;
}

export async function openRecentCharacter(index) {
  const item = state.recentDirectories[index];
  if (!item?.path) {
    return;
  }

  try {
    await loadCharacterFromDirectoryPath(item.path);
  } catch (error) {
    setSyncStatus(`Errore apertura recente: ${error.message}`, "warn");
    throw error;
  }
}

export async function tryAutoLoad() {
  try {
    await refreshRecentDirectories();
    const savedDirectoryPath = await loadHandle();
    if (savedDirectoryPath) {
      console.log("Attempting to restore saved handle...");
      console.log("Auto-loaded character data.");
      await loadCharacterFromDirectoryPath(savedDirectoryPath);
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
