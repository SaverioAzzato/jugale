import { create } from "zustand";

/** Small persisted app-preferences store (things that aren't theme or locale). */
const KEY = "dndm.settings";

export type UnitSystem = "imperial" | "metric";

interface Persisted {
  toastSeconds: number;
  units: UnitSystem;
}

const DEFAULTS: Persisted = { toastSeconds: 10, units: "imperial" };

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
  setUnits: (u: UnitSystem) => void;
}

function persist(state: Persisted) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  setToastSeconds: (toastSeconds) => {
    set({ toastSeconds });
    persist({ toastSeconds, units: get().units });
  },
  setUnits: (units) => {
    set({ units });
    persist({ toastSeconds: get().toastSeconds, units });
  },
}));
