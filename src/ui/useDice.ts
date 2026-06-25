import { create } from "zustand";

/** A die rolled onto the screen. Purely ephemeral UI — never part of `character.json`. */
export interface RolledDie {
  id: string;
  sides: number;
  result: number;
}

interface DiceState {
  dice: RolledDie[];
  /** Roll one die of `sides` and drop it on the screen. The 3D layer picks where. */
  roll: (sides: number) => void;
  /** Remove a die (the scene plays its exit animation first). */
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

export const useDice = create<DiceState>((set) => ({
  dice: [],
  roll: (sides) =>
    set((s) => ({
      dice: [...s.dice, { id: `die-${++counter}`, sides, result: 1 + Math.floor(Math.random() * sides) }],
    })),
  dismiss: (id) => set((s) => ({ dice: s.dice.filter((d) => d.id !== id) })),
  clear: () => set({ dice: [] }),
}));
