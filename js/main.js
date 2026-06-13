/**
 * Main entry point - coordinates all modules
 */

import { state, elements } from "./state.js";
import { bindEvents, setupGlobalAPI } from "./events.js";
import { renderCharacter, renderSessionSummaryContent } from "./render.js";
import { initPortrait } from "./portrait.js";
import {
  initCharacterData,
  tryAutoLoad,
  scheduleSave,
} from "./character-data.js";
import { expandTocInline } from "./ui-controls.js";
import { initTheme } from "./theme.js";

// UI state
let syncStatus = null;
let syncLabel = null;

function setSyncStatus(text, mode) {
  elements.syncLabel.textContent = text;
  elements.syncPill.className = `sync-pill ${mode}`;
  elements.syncPill.hidden = false;
}

// Initialize all modules
initPortrait(scheduleSave, renderCharacter);
initCharacterData(setSyncStatus, renderSessionSummaryContent);

// Bind events
bindEvents();
setupGlobalAPI();
initTheme(elements.themeToggleBtn);

// Initialize UI
expandTocInline();

// Try to auto-load previously opened character
renderCharacter();
tryAutoLoad();
