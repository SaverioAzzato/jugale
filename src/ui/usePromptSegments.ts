import { create } from "zustand";
import { DEFAULT_SEGMENTS, type PromptSegments } from "../prompts/prompts";

/** Persisted user edits to the prompt building blocks. Reset clears back to DEFAULT_SEGMENTS. */
const KEY = "dndm.prompts";

function load(): { segments: PromptSegments; customized: boolean } {
  if (typeof localStorage === "undefined") return { segments: DEFAULT_SEGMENTS, customized: false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved || typeof saved !== "object") return { segments: DEFAULT_SEGMENTS, customized: false };
    return {
      customized: true,
      segments: {
        baseIntro: typeof saved.baseIntro === "string" ? saved.baseIntro : DEFAULT_SEGMENTS.baseIntro,
        baseContract: typeof saved.baseContract === "string" ? saved.baseContract : DEFAULT_SEGMENTS.baseContract,
        tasks: { ...DEFAULT_SEGMENTS.tasks, ...(saved.tasks && typeof saved.tasks === "object" ? saved.tasks : {}) },
      },
    };
  } catch {
    return { segments: DEFAULT_SEGMENTS, customized: false };
  }
}

interface PromptSegmentsState {
  segments: PromptSegments;
  /** Whether the segments differ from the shipped defaults (i.e. there's something to reset). */
  customized: boolean;
  save: (segments: PromptSegments) => void;
  reset: () => void;
}

export const usePromptSegments = create<PromptSegmentsState>((set) => ({
  ...load(),
  save: (segments) => {
    set({ segments, customized: true });
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(segments));
  },
  reset: () => {
    set({ segments: DEFAULT_SEGMENTS, customized: false });
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  },
}));
