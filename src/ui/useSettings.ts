import { create } from "zustand";

/** Small persisted app-preferences store (things that aren't theme or locale). */
const KEY = "dndm.settings";

interface Persisted {
  toastSeconds: number;
}

const DEFAULTS: Persisted = { toastSeconds: 10 };

function load(): Persisted {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

interface SettingsState extends Persisted {
  setToastSeconds: (n: number) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  setToastSeconds: (toastSeconds) => {
    set({ toastSeconds });
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify({ toastSeconds: get().toastSeconds }));
    }
  },
}));
