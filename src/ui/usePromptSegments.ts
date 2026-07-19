import { create } from "zustand";
import { DEFAULT_SEGMENTS, type PromptSegments } from "../prompts/prompts";

/**
 * Persisted user edits to the prompt building blocks (per device). While the user hasn't
 * customized anything, the page shows the shipped defaults for the current UI language and they
 * follow a language switch. Once the user saves an edit, that whole set is frozen exactly as saved
 * (in whatever language they wrote) and no longer auto-translates — Reset clears back to defaults.
 */
const KEY = "dndm.prompts";
const CUSTOM_KEY = "dndm.promptCustom";

function load(): { saved: PromptSegments | null; customized: boolean } {
  if (typeof localStorage === "undefined") return { saved: null, customized: false };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object") return { saved: null, customized: false };
    const saved: PromptSegments = {
      baseIntro: typeof raw.baseIntro === "string" ? raw.baseIntro : DEFAULT_SEGMENTS.baseIntro,
      baseContract: typeof raw.baseContract === "string" ? raw.baseContract : DEFAULT_SEGMENTS.baseContract,
      tasks: { ...DEFAULT_SEGMENTS.tasks, ...(raw.tasks && typeof raw.tasks === "object" ? raw.tasks : {}) },
    };
    return { saved, customized: true };
  } catch {
    return { saved: null, customized: false };
  }
}

function loadCustom(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(CUSTOM_KEY) ?? "";
}

interface PromptSegmentsState {
  /** The user's saved segments, or null when they haven't customized (→ use language defaults). */
  saved: PromptSegments | null;
  /** Whether there's a saved customization to reset. */
  customized: boolean;
  /** Free-text instruction appended to the base of every composed prompt (independent of `saved`). */
  custom: string;
  save: (segments: PromptSegments) => void;
  reset: () => void;
  setCustom: (custom: string) => void;
}

export const usePromptSegments = create<PromptSegmentsState>((set) => ({
  ...load(),
  custom: loadCustom(),
  save: (segments) => {
    set({ saved: segments, customized: true });
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(segments));
  },
  reset: () => {
    set({ saved: null, customized: false });
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  },
  setCustom: (custom) => {
    set({ custom });
    if (typeof localStorage === "undefined") return;
    if (custom) localStorage.setItem(CUSTOM_KEY, custom);
    else localStorage.removeItem(CUSTOM_KEY);
  },
}));
