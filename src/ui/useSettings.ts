import { create } from "zustand";

/** Small persisted app-preferences store (things that aren't theme or locale). */
const KEY = "dndm.settings";

export type UnitSystem = "imperial" | "metric";
export const UI_SCALES = [80, 90, 100, 110, 120] as const;
export type UiScale = (typeof UI_SCALES)[number];

interface Persisted {
  toastSeconds: number;
  units: UnitSystem;
  uiScale: UiScale;
}

const DEFAULTS: Persisted = { toastSeconds: 10, units: "imperial", uiScale: 100 };

function isUiScale(value: unknown): value is UiScale {
  return typeof value === "number" && UI_SCALES.includes(value as UiScale);
}

function applyUiScale(uiScale: UiScale): void {
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--ui-scale", String(uiScale / 100));
  }
}

function load(): Persisted {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Persisted>;
    return {
      toastSeconds: typeof saved.toastSeconds === "number" ? saved.toastSeconds : DEFAULTS.toastSeconds,
      units: saved.units === "metric" || saved.units === "imperial" ? saved.units : DEFAULTS.units,
      uiScale: isUiScale(saved.uiScale) ? saved.uiScale : DEFAULTS.uiScale,
    };
  } catch {
    return DEFAULTS;
  }
}

interface SettingsState extends Persisted {
  setToastSeconds: (n: number) => void;
  setUnits: (u: UnitSystem) => void;
  setUiScale: (scale: UiScale) => void;
}

function persist(state: Persisted) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
}

const initial = load();
applyUiScale(initial.uiScale);

function currentPersisted(get: () => SettingsState, patch: Partial<Persisted>): Persisted {
  const state = get();
  return { toastSeconds: state.toastSeconds, units: state.units, uiScale: state.uiScale, ...patch };
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...initial,
  setToastSeconds: (toastSeconds) => {
    set({ toastSeconds });
    persist(currentPersisted(get, { toastSeconds }));
  },
  setUnits: (units) => {
    set({ units });
    persist(currentPersisted(get, { units }));
  },
  setUiScale: (uiScale) => {
    set({ uiScale });
    applyUiScale(uiScale);
    persist(currentPersisted(get, { uiScale }));
  },
}));
