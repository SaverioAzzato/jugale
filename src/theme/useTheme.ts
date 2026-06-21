import { create } from "zustand";

export const THEMES = [
  { id: "arcane", label: "Arcano" },
  { id: "night", label: "Notte" },
  { id: "parchment", label: "Pergamena" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "dndm.theme";
const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

function apply(id: ThemeId): void {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = id;
}

function initialTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(saved)) return saved;
  } catch {
    /* localStorage unavailable */
  }
  return "arcane";
}

const initial = initialTheme();
apply(initial); // set before first paint to avoid a flash

export const useTheme = create<{ theme: ThemeId; setTheme: (id: ThemeId) => void }>((set) => ({
  theme: initial,
  setTheme: (id) => {
    apply(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    set({ theme: id });
  },
}));
