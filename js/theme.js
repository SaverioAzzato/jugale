/**
 * Theme management (dark/light)
 */

import { state } from "./state.js";

const STORAGE_KEY = "dnd-manager-theme";
const THEMES = {
  DARK: "dark",
  LIGHT: "light",
};

function normalizeTheme(theme) {
  return theme === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
}

function setThemeToggleLabel(button, theme) {
  if (!button) {
    return;
  }

  const isDark = theme === THEMES.DARK;
  const label = isDark ? "Tema: Scuro" : "Tema: Chiaro";
  const action = isDark ? "Passa al tema chiaro" : "Passa al tema scuro";

  button.textContent = label;
  button.setAttribute("aria-label", action);
  button.title = action;
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
  const nextTheme = state.theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
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
