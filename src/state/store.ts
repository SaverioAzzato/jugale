import { create } from "zustand";
import { loadCharacter, type Character, type Issue } from "../schema";

interface CharacterState {
  character: Character | null;
  issues: Issue[];
  migrated: boolean;
  ok: boolean;
  sourceName: string;
  /** Load raw JSON (migrated + validated) into the store. Never throws. */
  loadRaw: (raw: unknown, sourceName?: string) => void;
}

/**
 * Single source of UI truth: the current character + its validation status.
 * In M1.2 this gains live-field mutations and debounced persistence.
 */
export const useCharacter = create<CharacterState>((set) => ({
  character: null,
  issues: [],
  migrated: false,
  ok: false,
  sourceName: "",
  loadRaw: (raw, sourceName = "") => {
    const result = loadCharacter(raw);
    set({
      character: result.character,
      issues: result.issues,
      migrated: result.migrated,
      ok: result.ok,
      sourceName,
    });
  },
}));
