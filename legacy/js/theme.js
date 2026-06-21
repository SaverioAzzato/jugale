/**
 * Theme management (Mihon-style presets)
 */

import { state } from "./state.js";

const STORAGE_KEY = "dnd-manager-theme";
const THEME_ORDER = ["dark", "night", "light"];

const THEME_LABELS = {
  dark: "Mihon Dark",
  night: "Mihon Night",
  light: "Mihon Light",
};

function normalizeTheme(theme) {
  return THEME_ORDER.includes(theme) ? theme : "dark";
}

function getNextTheme(theme) {
  const index = THEME_ORDER.indexOf(theme);
  const nextIndex = (index + 1) % THEME_ORDER.length;
  return THEME_ORDER[nextIndex];
}

function setThemeToggleLabel(button, theme) {
  if (!button) {
    return;
  }

  const currentLabel = THEME_LABELS[theme] || THEME_LABELS.dark;
  const nextTheme = getNextTheme(theme);
  const nextLabel = THEME_LABELS[nextTheme] || THEME_LABELS.dark;

  button.textContent = `Tema: ${currentLabel}`;
  button.setAttribute("aria-label", `Cambia tema (prossimo: ${nextLabel})`);
  button.title = `Prossimo: ${nextLabel}`;
}

function persistTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures and keep in-memory theme only.
  }
}

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function applyTheme(theme, button) {
  const normalizedTheme = normalizeTheme(theme);
  state.theme = normalizedTheme;
  document.body.setAttribute("data-theme", normalizedTheme);
  setThemeToggleLabel(button, normalizedTheme);
}

export function toggleTheme(button) {
  const nextTheme = getNextTheme(state.theme);
  applyTheme(nextTheme, button);
  persistTheme(nextTheme);
}

export function initTheme(button) {
  const storedTheme = normalizeTheme(readStoredTheme());
  applyTheme(storedTheme, button);

  if (button) {
    button.addEventListener("click", () => toggleTheme(button));
  }
}
