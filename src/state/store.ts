import { create } from "zustand";
import { loadCharacter, maxHitDice, type Character, type Issue } from "../schema";
import { applyAction, getByPath, makeRng, type FormulaChange, type RolledFace } from "../model/formula";
import { setIn, insertAt, removeAt, type Path } from "../model/edit";
import { translate, useI18n, type StringKey } from "../i18n/useI18n";
import { useToast } from "../ui/useToast";
import { useDice } from "../ui/useDice";
import { type GalleryImage, type StorageProvider } from "../storage/provider";
import { saveCharacterAs } from "../storage/exporter";

const FIELD_LABEL: Record<string, StringKey> = {
  "combat.hp.current": "vitals.hp",
  "combat.hp.temp": "vitals.temp",
  "combat.hp.hitDiceRemaining": "vitals.hitDice",
};

/** "PF +5, Dadi Vita −1" — non-zero changes only, with localized field labels. */
function describeChanges(changes: FormulaChange[], c: Character): string {
  const locale = useI18n.getState().locale;
  return changes
    .map((ch) => {
      const delta = ch.after - ch.before;
      if (delta === 0) return null;
      let label = FIELD_LABEL[ch.path] ? translate(locale, FIELD_LABEL[ch.path]) : "";
      if (!label) {
        const res = ch.path.match(/^resources\.([^.]+)\.current$/);
        label = (res && c.resources.find((r) => r.id === res[1])?.label) || ch.path;
      }
      return `${label} ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`;
    })
    .filter(Boolean)
    .join(", ");
}

/** Diff the standard live numeric fields (HP, hit dice, resource pools) between two states. */
function diffLiveFields(before: Character, after: Character): FormulaChange[] {
  const paths = [
    "combat.hp.current",
    "combat.hp.temp",
    "combat.hp.hitDiceRemaining",
    ...before.resources.map((r) => `resources.${r.id}.current`),
  ];
  const out: FormulaChange[] = [];
  for (const p of paths) {
    const b = getByPath(before, p);
    const a = getByPath(after, p);
    if (typeof b === "number" && typeof a === "number" && a !== b) out.push({ path: p, before: b, after: a });
  }
  return out;
}

/** Emit error toasts, then a success toast summarizing changes (+ dice rolls subtitle). */
function notify(label: string, c: Character, changes: FormulaChange[], rolls: string[], errors: string[]): void {
  if (errors.length > 0) {
    const prefix = translate(useI18n.getState().locale, "toast.formulaError");
    errors.forEach((e) => useToast.getState().push("error", `${prefix}: ${e}`));
  }
  const summary = describeChanges(changes, c);
  if (summary) useToast.getState().push("success", `${label} — ${summary}`, rolls.length ? rolls.join(" · ") : undefined);
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Drop spell material rows with no text (blank ones the user added and left empty).
 *  Returns the same reference when nothing changed, so callers can skip a no-op save. */
function pruneEmptyMaterials(c: Character): Character {
  let changed = false;
  const spellSections = c.spellSections.map((sec) => ({
    ...sec,
    entries: sec.entries.map((e) => {
      if (!Array.isArray(e.materials) || e.materials.length === 0) return e;
      const kept = e.materials.filter((m) => (m.text ?? "").trim() !== "");
      if (kept.length === e.materials.length) return e;
      changed = true;
      return { ...e, materials: kept };
    }),
  }));
  return changed ? { ...c, spellSections } : c;
}

/** Regaining HP from 0 clears death saves, so a later death starts the count fresh. */
function clearDeathOnRevive(before: Character, after: Character): Character {
  const ds = after.session.deathSaves;
  if (before.combat.hp.current <= 0 && after.combat.hp.current > 0 && (ds.successes > 0 || ds.failures > 0)) {
    return { ...after, session: { ...after.session, deathSaves: { ...ds, successes: 0, failures: 0 } } };
  }
  return after;
}

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
  /** Runtime images from the character's `images/` folder (filename order). Never persisted. */
  images: GalleryImage[];

  provider: StorageProvider | null;
  liveSync: boolean;
  dirty: boolean;
  saveError: string | null;
  /** A live-synced file/folder whose last write failed: sync is given up so we don't keep
   *  failing silently — surfaced as a read-only badge, with Export as the way to keep changes. */
  readOnly: boolean;
  /** Edit mode: the whole sheet becomes an interactive editor of the JSON. Transient —
   *  always starts off on a fresh load, so a session never opens in an editable state. */
  editMode: boolean;

  /** Load into memory only (sample / import) — edits are kept until exported. `readOnly`
   *  flags a real file/folder that this host simply can't write back to live (the no-write
   *  fallback import), so the UI warns up front instead of waiting for a write to fail. */
  loadRaw: (raw: unknown, sourceName?: string, images?: GalleryImage[], readOnly?: boolean) => void;
  /** Connect a live file/folder: edits are written back (debounced). */
  connect: (
    provider: StorageProvider,
    raw: unknown,
    sourceName: string,
    images?: GalleryImage[],
  ) => void;
  /** Save a copy of the character to a user-chosen destination (native picker where available),
   *  then confirm it — with the path/filename where the host can report one. */
  exportCharacter: () => Promise<void>;
  /** Return to welcome state (no loaded character). */
  clear: () => void;

  // ---- edit mode (structural editing of the JSON) ----
  /** Flip in/out of edit mode. */
  toggleEditMode: () => void;
  /** Set any field at a path (text/number/boolean/enum). */
  editField: (path: Path, value: unknown) => void;
  /** Append a new entry to the array at `path` (use a factory for the entry). */
  addItem: (path: Path, item: unknown) => void;
  /** Remove the entry at `index` from the array at `path`. */
  removeItem: (path: Path, index: number) => void;

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

/** Release object URLs from a previous folder load so blobs don't leak on reload/clear. */
function revokeImages(images: GalleryImage[]): void {
  for (const img of images) {
    if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
  }
}

export const useCharacter = create<CharacterState>((set, get) => {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let validateTimer: ReturnType<typeof setTimeout> | null = null;

  // Re-run validation after a structural edit so the issues chip stays live. Only `issues`
  // is updated — never `character`, or Zod's defaults/coercions would clobber whatever the
  // user is mid-typing (e.g. a temporarily-empty name). Derived values (AC, PB, mod) need
  // nothing: they recompute at render time.
  const scheduleRevalidate = () => {
    if (validateTimer) clearTimeout(validateTimer);
    validateTimer = setTimeout(() => {
      const c = get().character;
      if (!c) return;
      set({ issues: loadCharacter(c).issues });
    }, 300);
  };

  /** Apply a structural edit, mark dirty, schedule a save + a revalidate. */
  const applyEdit = (next: Character) => {
    set({ character: next, dirty: true });
    scheduleSave();
    scheduleRevalidate();
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const { provider, liveSync, character } = get();
      if (!provider || !liveSync || !character) return;
      try {
        await provider.write(character);
        set({ dirty: false, saveError: null });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const locale = useI18n.getState().locale;
        useToast.getState().push("error", translate(locale, "toast.saveFailed"), message);
        set({ saveError: message, liveSync: false, readOnly: true });
      }
    }, 250);
  };

  /** Apply an immutable patch to the character, mark dirty, schedule a save. */
  const mutate = (fn: (c: Character) => Character) => {
    const c = get().character;
    if (!c) return;
    set({ character: clearDeathOnRevive(c, fn(c)), dirty: true });
    scheduleSave();
  };

  const patchHp = (
    c: Character,
    hp: Partial<Character["combat"]["hp"]>,
  ): Character => ({
    ...c,
    combat: { ...c.combat, hp: { ...c.combat.hp, ...hp } },
  });

  /** Built-in rest reset + any registered actions of that kind, with a summary toast. */
  const doRest = (kind: "shortRest" | "longRest") => {
    const c = get().character;
    if (!c) return;
    const rng = makeRng(Date.now());

    let rested: Character;
    if (kind === "shortRest") {
      rested = {
        ...c,
        resources: c.resources.map((r) => (r.resetOn === "shortRest" ? { ...r, current: r.max } : r)),
      };
    } else {
      const resets = new Set(["shortRest", "longRest", "dawn"]);
      // RAW: a long rest recovers up to half your total Hit Dice (min 1).
      const regained = Math.max(1, Math.floor(maxHitDice(c) / 2));
      rested = {
        ...patchHp(c, {
          current: c.combat.hp.max || c.combat.hp.current,
          temp: 0,
          hitDiceRemaining: clamp(c.combat.hp.hitDiceRemaining + regained, 0, maxHitDice(c)),
        }),
        resources: c.resources.map((r) => (resets.has(r.resetOn) ? { ...r, current: r.max } : r)),
      };
    }

    let cur = rested;
    const errors: string[] = [];
    const rolls: string[] = [];
    const faces: RolledFace[] = [];
    for (const a of c.actions.filter((x) => x.kind === kind)) {
      const r = applyAction(cur, a.formulas, rng);
      cur = r.character;
      errors.push(...r.errors);
      rolls.push(...r.rolls);
      faces.push(...r.faces);
    }

    const label = translate(useI18n.getState().locale, kind === "shortRest" ? "vitals.shortRest" : "vitals.longRest");
    notify(label, c, diffLiveFields(c, cur), rolls, errors);
    if (faces.length) useDice.getState().present(faces);
    set({ character: clearDeathOnRevive(c, cur), dirty: true });
    scheduleSave();
  };

  return {
    character: null,
    issues: [],
    migrated: false,
    ok: false,
    sourceName: "",
    images: [],
    provider: null,
    liveSync: false,
    dirty: false,
    saveError: null,
    readOnly: false,
    editMode: false,

    loadRaw: (raw, sourceName = "", images = [], readOnly = false) => {
      const r = loadCharacter(raw);
      revokeImages(get().images);
      set({
        ...r,
        sourceName,
        images,
        provider: null,
        liveSync: false,
        dirty: false,
        saveError: null,
        readOnly,
        editMode: false,
      });
    },

    connect: (provider, raw, sourceName, images = []) => {
      const r = loadCharacter(raw);
      revokeImages(get().images);
      set({
        ...r,
        sourceName,
        images,
        provider,
        liveSync: true,
        dirty: false,
        saveError: null,
        readOnly: false,
        editMode: false,
      });
    },

    exportCharacter: async () => {
      const { character } = get();
      if (!character) return;
      const outcome = await saveCharacterAs(character, `${slug(character.meta.name)}.json`);
      const locale = useI18n.getState().locale;
      const push = useToast.getState().push;
      if (outcome.status === "cancelled") return; // user backed out of the picker — say nothing
      if (outcome.status === "error") {
        push("error", translate(locale, "toast.exportFailed"), outcome.message);
        return;
      }
      // Success: confirm, and name the destination where the host can (path on desktop, filename
      // on Android/Chromium; a plain "check downloads" where the browser hides it).
      const detail = outcome.kind === "download" ? translate(locale, "toast.checkDownloads") : outcome.location;
      push("success", translate(locale, "toast.exported"), detail);
      set({ dirty: false });
    },

    clear: () => {
      revokeImages(get().images);
      set({
        character: null,
        issues: [],
        migrated: false,
        ok: false,
        sourceName: "",
        images: [],
        provider: null,
        liveSync: false,
        dirty: false,
        saveError: null,
        readOnly: false,
        editMode: false,
      });
    },

    toggleEditMode: () => {
      // Leaving Edit mode drops any material rows the user added but left blank.
      if (get().editMode) {
        const c = get().character;
        if (c) {
          const cleaned = pruneEmptyMaterials(c);
          if (cleaned !== c) {
            set({ character: cleaned, dirty: true });
            scheduleSave();
          }
        }
      }
      set({ editMode: !get().editMode });
    },

    editField: (path, value) => {
      const c = get().character;
      if (!c) return;
      applyEdit(setIn(c, path, value));
    },

    addItem: (path, item) => {
      const c = get().character;
      if (!c) return;
      applyEdit(insertAt(c, path, item));
    },

    removeItem: (path, index) => {
      const c = get().character;
      if (!c) return;
      applyEdit(removeAt(c, path, index));
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

    runAction: (id) => {
      const c = get().character;
      if (!c) return;
      const action = c.actions.find((a) => a.id === id);
      if (!action) return;
      const { character, changes, errors, rolls, faces } = applyAction(c, action.formulas, makeRng(Date.now()));
      notify(action.label || action.id, c, changes, rolls, errors);
      if (faces.length) useDice.getState().present(faces);
      if (changes.length > 0) {
        set({ character: clearDeathOnRevive(c, character), dirty: true });
        scheduleSave();
      }
    },

    shortRest: () => doRest("shortRest"),
    longRest: () => doRest("longRest"),

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
