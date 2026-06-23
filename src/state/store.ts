import { create } from "zustand";
import { loadCharacter, maxHitDice, type Character, type Issue } from "../schema";
import { applyFormulas, makeRng } from "../model/formula";
import { exportJson, type StorageProvider } from "../storage/provider";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "personaggio";

interface CharacterState {
  character: Character | null;
  issues: Issue[];
  migrated: boolean;
  ok: boolean;
  sourceName: string;

  provider: StorageProvider | null;
  liveSync: boolean;
  dirty: boolean;
  saveError: string | null;

  /** Load into memory only (sample / import) — edits are kept until exported. */
  loadRaw: (raw: unknown, sourceName?: string) => void;
  /** Connect a live file: edits are written back (debounced). */
  connect: (
    provider: StorageProvider,
    raw: unknown,
    sourceName: string,
  ) => void;
  /** Download the current character as JSON. */
  exportCharacter: () => void;
  /** Return to welcome state (no loaded character). */
  clear: () => void;

  // ---- live play-state mutations (the only fields the UI changes continuously) ----
  setCurrentHp: (n: number) => void;
  setTempHp: (n: number) => void;
  damage: (n: number) => void;
  heal: (n: number) => void;
  adjustResource: (id: string, delta: number) => void;
  adjustHitDice: (delta: number) => void;
  runAction: (id: string) => void;
  shortRest: () => void;
  longRest: () => void;
  setItemQuantity: (index: number, qty: number) => void;
  toggleEquipped: (index: number) => void;
  setCurrency: (code: string, value: number) => void;
  addCondition: (name: string) => void;
  removeCondition: (name: string) => void;
  toggleInspiration: () => void;
  setDeathSave: (kind: "successes" | "failures", value: number) => void;
}

export const useCharacter = create<CharacterState>((set, get) => {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const { provider, liveSync, character } = get();
      if (!provider || !liveSync || !character) return;
      try {
        await provider.write(character);
        set({ dirty: false, saveError: null });
      } catch (e) {
        set({ saveError: e instanceof Error ? e.message : String(e) });
      }
    }, 250);
  };

  /** Apply an immutable patch to the character, mark dirty, schedule a save. */
  const mutate = (fn: (c: Character) => Character) => {
    const c = get().character;
    if (!c) return;
    set({ character: fn(c), dirty: true });
    scheduleSave();
  };

  const patchHp = (
    c: Character,
    hp: Partial<Character["combat"]["hp"]>,
  ): Character => ({
    ...c,
    combat: { ...c.combat, hp: { ...c.combat.hp, ...hp } },
  });

  return {
    character: null,
    issues: [],
    migrated: false,
    ok: false,
    sourceName: "",
    provider: null,
    liveSync: false,
    dirty: false,
    saveError: null,

    loadRaw: (raw, sourceName = "") => {
      const r = loadCharacter(raw);
      set({
        ...r,
        sourceName,
        provider: null,
        liveSync: false,
        dirty: false,
        saveError: null,
      });
    },

    connect: (provider, raw, sourceName) => {
      const r = loadCharacter(raw);
      set({
        ...r,
        sourceName,
        provider,
        liveSync: true,
        dirty: false,
        saveError: null,
      });
    },

    exportCharacter: () => {
      const { character } = get();
      if (!character) return;
      exportJson(character, `${slug(character.meta.name)}.json`);
      set({ dirty: false });
    },

    clear: () => {
      set({
        character: null,
        issues: [],
        migrated: false,
        ok: false,
        sourceName: "",
        provider: null,
        liveSync: false,
        dirty: false,
        saveError: null,
      });
    },

    setCurrentHp: (n) =>
      mutate((c) => patchHp(c, { current: Math.max(0, Math.floor(n) || 0) })),
    setTempHp: (n) =>
      mutate((c) => patchHp(c, { temp: Math.max(0, Math.floor(n) || 0) })),

    damage: (n) =>
      mutate((c) => {
        const fromTemp = Math.min(c.combat.hp.temp, n);
        return patchHp(c, {
          temp: c.combat.hp.temp - fromTemp,
          current: Math.max(0, c.combat.hp.current - (n - fromTemp)),
        });
      }),

    heal: (n) =>
      mutate((c) => {
        const cap =
          c.combat.hp.max > 0 ? c.combat.hp.max : c.combat.hp.current + n;
        return patchHp(c, { current: Math.min(cap, c.combat.hp.current + n) });
      }),

    adjustResource: (id, delta) =>
      mutate((c) => ({
        ...c,
        resources: c.resources.map((r) =>
          r.id === id
            ? { ...r, current: clamp(r.current + delta, 0, r.max) }
            : r,
        ),
      })),

    adjustHitDice: (delta) =>
      mutate((c) =>
        patchHp(c, {
          hitDiceRemaining: clamp(c.combat.hp.hitDiceRemaining + delta, 0, maxHitDice(c)),
        }),
      ),

    runAction: (id) =>
      mutate((c) => {
        const action = c.actions.find((a) => a.id === id);
        if (!action) return c;
        return applyFormulas(c, action.formulas, makeRng(Date.now()));
      }),

    shortRest: () =>
      mutate((c) => {
        const rng = makeRng(Date.now());
        const rested: Character = {
          ...c,
          resources: c.resources.map((r) =>
            r.resetOn === "shortRest" ? { ...r, current: r.max } : r,
          ),
        };
        // Built-in reset, then any registered short-rest actions (formulae).
        return c.actions
          .filter((a) => a.kind === "shortRest")
          .reduce((acc, a) => applyFormulas(acc, a.formulas, rng), rested);
      }),

    longRest: () =>
      mutate((c) => {
        const rng = makeRng(Date.now());
        const resets = new Set(["shortRest", "longRest", "dawn"]);
        // RAW: a long rest recovers up to half your total Hit Dice (min 1).
        const regained = Math.max(1, Math.floor(maxHitDice(c) / 2));
        const rested: Character = {
          ...patchHp(c, {
            current: c.combat.hp.max || c.combat.hp.current,
            temp: 0,
            hitDiceRemaining: clamp(c.combat.hp.hitDiceRemaining + regained, 0, maxHitDice(c)),
          }),
          resources: c.resources.map((r) =>
            resets.has(r.resetOn) ? { ...r, current: r.max } : r,
          ),
        };
        return c.actions
          .filter((a) => a.kind === "longRest")
          .reduce((acc, a) => applyFormulas(acc, a.formulas, rng), rested);
      }),

    setItemQuantity: (index, qty) =>
      mutate((c) => ({
        ...c,
        inventory: {
          ...c.inventory,
          items: c.inventory.items.map((it, i) =>
            i === index ? { ...it, quantity: Math.max(0, qty) } : it,
          ),
        },
      })),

    toggleEquipped: (index) =>
      mutate((c) => ({
        ...c,
        inventory: {
          ...c.inventory,
          items: c.inventory.items.map((it, i) =>
            i === index ? { ...it, equipped: !it.equipped } : it,
          ),
        },
      })),

    setCurrency: (code, value) =>
      mutate((c) => ({
        ...c,
        inventory: {
          ...c.inventory,
          currencies: { ...c.inventory.currencies, [code]: Math.max(0, value) },
        },
      })),

    addCondition: (name) =>
      mutate((c) => {
        const trimmed = name.trim();
        if (!trimmed || c.session.conditions.includes(trimmed)) return c;
        return { ...c, session: { ...c.session, conditions: [...c.session.conditions, trimmed] } };
      }),

    removeCondition: (name) =>
      mutate((c) => ({
        ...c,
        session: { ...c.session, conditions: c.session.conditions.filter((x) => x !== name) },
      })),

    toggleInspiration: () =>
      mutate((c) => ({ ...c, session: { ...c.session, inspiration: !c.session.inspiration } })),

    setDeathSave: (kind, value) =>
      mutate((c) => ({
        ...c,
        session: {
          ...c.session,
          deathSaves: { ...c.session.deathSaves, [kind]: clamp(value, 0, 3) },
        },
      })),
  };
});
