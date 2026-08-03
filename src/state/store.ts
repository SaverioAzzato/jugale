import { create } from "zustand";
import {
  loadCharacter,
  maxHitDice,
  type Character,
  type AbilityId,
  type CharacterValidation,
  type Issue,
  type LoadResult,
} from "../schema";
import { applyAction, getByPath, makeRng, type FormulaChange, type RolledFace } from "../model/formula";
import { setIn, insertAt, removeAt, type Path } from "../model/edit";
import { type StringKey } from "../i18n/useI18n";
import { type GalleryImage, type StorageProvider } from "../storage/provider";
import type { CharacterVersion, VersionReason } from "../storage/versions";
import { createPersistenceCoordinator } from "./persistenceCoordinator";
import { createVersionCoordinator } from "./versionCoordinator";
import {
  addCondition,
  adjustHitDice,
  adjustResource,
  clamp,
  clearDeathOnRevive,
  damage,
  heal,
  patchDraftFromProjection,
  patchHp,
  pruneEmptyMaterials,
  removeCondition,
  setCurrency,
  setCurrentHp,
  setDeathSave,
  setItemQuantity,
  setTempHp,
  toggleEquipped,
  toggleInspiration,
} from "./characterMutations";

export interface CharacterStoreDependencies {
  now(): number;
  makeRng(seed: number): ReturnType<typeof makeRng>;
  schedule(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  cancelScheduled(handle: ReturnType<typeof setTimeout>): void;
  t(key: StringKey): string;
  toast: { push(kind: "success" | "error" | "info", message: string, detail?: string): void };
  presentDice(faces: RolledFace[]): void;
  versionHistoryEnabled(): boolean;
  exportDocument(data: unknown, defaultName: string): Promise<boolean>;
}

export type CoreCharacterEdit =
  | { field: "meta.name" | "meta.player" | "meta.summary"; value: string }
  | { field: "ability.score"; ability: AbilityId; value: number }
  | { field: "ability.saveProficient"; ability: AbilityId; value: boolean }
  | { field: "ability.modifierOverride"; ability: AbilityId; value: number | null }
  | { field: "combat.hp.max"; value: number }
  | { field: "class.level"; index: number; value: number };

function coreEditPath(edit: CoreCharacterEdit): Path {
  switch (edit.field) {
    case "meta.name": return ["meta", "name"];
    case "meta.player": return ["meta", "player"];
    case "meta.summary": return ["meta", "summary"];
    case "ability.score": return ["abilities", edit.ability, "score"];
    case "ability.saveProficient": return ["abilities", edit.ability, "saveProficient"];
    case "ability.modifierOverride": return ["abilities", edit.ability, "modifierOverride"];
    case "combat.hp.max": return ["combat", "hp", "max"];
    case "class.level": return ["classes", edit.index, "level"];
  }
}

const FIELD_LABEL: Record<string, StringKey> = {
  "combat.hp.current": "vitals.hp",
  "combat.hp.temp": "vitals.temp",
  "combat.hp.hitDiceRemaining": "vitals.hitDice",
};

/** "PF +5, Dadi Vita −1" — non-zero changes only, with localized field labels. */
function describeChanges(changes: FormulaChange[], c: Character, t: CharacterStoreDependencies["t"]): string {
  return changes
    .map((ch) => {
      const delta = ch.after - ch.before;
      if (delta === 0) return null;
      let label = FIELD_LABEL[ch.path] ? t(FIELD_LABEL[ch.path]) : "";
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
function notify(
  deps: CharacterStoreDependencies,
  label: string,
  c: Character,
  changes: FormulaChange[],
  rolls: string[],
  errors: string[],
): void {
  if (errors.length > 0) {
    const prefix = deps.t("toast.formulaError");
    errors.forEach((e) => deps.toast.push("error", `${prefix}: ${e}`));
  }
  const summary = describeChanges(changes, c, deps.t);
  if (summary) deps.toast.push("success", `${label} — ${summary}`, rolls.length ? rolls.join(" · ") : undefined);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "personaggio";

export interface CharacterState {
  /** Original parsed input for recovery/provenance. */
  source: unknown | null;
  /** Lossless working JSON. All edits target this value. */
  draft: unknown | null;
  validation: CharacterValidation | null;
  /** Exact document known to be in the bound provider after its last successful read/write. */
  lastPersisted: unknown | null;
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
  /** True while a checkpoint or full-character replacement owns the persistence pipeline. */
  versionBusy: boolean;

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
  /** Cancel the debounce, await any active write, then persist the exact latest state. */
  flushPendingSave: () => Promise<boolean>;
  /** Create an intentional snapshot. Returns null when unavailable, busy or failed. */
  createVersion: (reason?: VersionReason, title?: string) => Promise<CharacterVersion | null>;
  /** Safely replace the complete character, optionally snapshotting before the write. */
  replaceCharacter: (
    raw: unknown,
    reason: "before-import" | "before-restore",
    snapshotOverride?: boolean,
  ) => Promise<boolean>;
  /** Replace the whole character from raw JSON (the raw-JSON editor). Runs the normal load
   *  pipeline (migrate → validate) so the sheet stays renderable even from half-edited input,
   *  marks dirty, and saves through the same debounced path (live-sync, else in-memory → export).
   *  The caller commits only already-parsed, valid JSON; syntax errors never reach here. */
  setRawJson: (raw: unknown) => void;
  /** Return to welcome state (no loaded character). */
  clear: () => void;

  // ---- edit mode (structural editing of the JSON) ----
  /** Flip in/out of edit mode. */
  toggleEditMode: () => void;
  /** Set any field at a path (text/number/boolean/enum). */
  editField: (path: Path, value: unknown) => void;
  /** Typed commands for high-frequency schema fields; prevents path/value mismatches at compile time. */
  editCoreField: (edit: CoreCharacterEdit) => void;
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

export function createCharacterStore(deps: CharacterStoreDependencies) {
  return create<CharacterState>((set, get) => {
  const loadedFields = (result: LoadResult) => ({
    source: result.source,
    draft: result.draft,
    validation: result.validation,
    character: result.projection,
    issues: result.issues,
    migrated: result.migrated,
    ok: result.ok,
  });

  const reportWriteFailure = (provider: StorageProvider, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (get().provider === provider) {
      deps.toast.push("error", deps.t("toast.saveFailed"), message);
      set({ saveError: message, liveSync: false, readOnly: true });
    }
  };

  const persistence = createPersistenceCoordinator({
    get,
    set,
    reportFailure: reportWriteFailure,
    schedule: deps.schedule,
    cancelScheduled: deps.cancelScheduled,
  });
  const flushPendingSave = persistence.flush;
  const versions = createVersionCoordinator({
    getState: get,
    setState: (patch) => set(patch),
    flushPendingSave,
    dependencies: deps,
  });

  /** Replace the lossless draft, then derive validation + projection without promoting either. */
  const commitDraft = (nextDraft: unknown) => {
    if (get().versionBusy || get().validation?.kind === "future-schema") return;
    const result = loadCharacter(nextDraft);
    set({
      draft: result.draft,
      validation: result.validation,
      character: result.projection,
      issues: result.issues,
      migrated: get().migrated || result.migrated,
      ok: result.ok,
      dirty: true,
    });
    persistence.schedule();
  };

  /** Apply a structural edit directly to the draft. */
  const applyEdit = (nextDraft: unknown) => commitDraft(nextDraft);

  /** Run existing typed domain logic on the projection, then copy only its changes to the draft. */
  const mutate = (fn: (c: Character) => Character) => {
    if (get().versionBusy) return;
    const { character: c, draft, validation } = get();
    if (!c || draft == null || validation?.kind === "future-schema") return;
    const next = clearDeathOnRevive(c, fn(c));
    commitDraft(patchDraftFromProjection(c, next, draft));
  };

  /** Built-in rest reset + any registered actions of that kind, with a summary toast. */
  const doRest = (kind: "shortRest" | "longRest") => {
    if (get().versionBusy) return;
    const c = get().character;
    if (!c) return;
    const rng = deps.makeRng(deps.now());

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

    const label = deps.t(kind === "shortRest" ? "vitals.shortRest" : "vitals.longRest");
    notify(deps, label, c, diffLiveFields(c, cur), rolls, errors);
    if (faces.length) deps.presentDice(faces);
    const draft = get().draft;
    if (draft != null) {
      const next = clearDeathOnRevive(c, cur);
      commitDraft(patchDraftFromProjection(c, next, draft));
    }
  };

  return {
    source: null,
    draft: null,
    validation: null,
    lastPersisted: null,
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
    versionBusy: false,

    loadRaw: (raw, sourceName = "", images = [], readOnly = false) => {
      persistence.cancel();
      const r = loadCharacter(raw);
      const future = r.validation.kind === "future-schema";
      revokeImages(get().images);
      set({
        ...loadedFields(r),
        lastPersisted: null,
        sourceName,
        images,
        provider: null,
        liveSync: false,
        dirty: false,
        saveError: null,
        readOnly: readOnly || future,
        editMode: false,
        versionBusy: false,
      });
    },

    connect: (provider, raw, sourceName, images = []) => {
      persistence.cancel();
      const r = loadCharacter(raw);
      revokeImages(get().images);
      const future = r.validation.kind === "future-schema";
      set({
        ...loadedFields(r),
        lastPersisted: r.source,
        sourceName,
        images,
        provider,
        liveSync: !future,
        dirty: false,
        saveError: null,
        readOnly: future,
        editMode: false,
        versionBusy: false,
      });
    },

    exportCharacter: async () => {
      const { character, draft, validation } = get();
      if (!character || draft == null) return;
      if (await deps.exportDocument(draft, `${slug(character.meta.name)}.json`) && validation?.kind === "valid") {
        set({ dirty: false });
      }
    },

    flushPendingSave,

    createVersion: versions.createVersion,

    replaceCharacter: versions.replaceCharacter,

    setRawJson: (raw) => {
      if (!get().character || get().versionBusy) return;
      const r = loadCharacter(raw);
      if (get().validation?.kind === "future-schema") return;
      set({
        draft: r.draft,
        validation: r.validation,
        character: r.projection,
        issues: r.issues,
        migrated: get().migrated || r.migrated,
        ok: r.ok,
        dirty: true,
      });
      persistence.schedule();
    },

    clear: () => {
      if (get().versionBusy) return;
      persistence.cancel();
      revokeImages(get().images);
      set({
        source: null,
        draft: null,
        validation: null,
        lastPersisted: null,
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
        versionBusy: false,
      });
    },

    toggleEditMode: () => {
      if (get().versionBusy) return;
      // Leaving Edit mode drops any material rows the user added but left blank.
      if (get().editMode) {
        const c = get().character;
        const draft = get().draft;
        if (c && draft != null) {
          const cleaned = pruneEmptyMaterials(c);
          if (cleaned !== c) {
            commitDraft(patchDraftFromProjection(c, cleaned, draft));
          }
        }
      }
      set({ editMode: !get().editMode });
    },

    editField: (path, value) => {
      const draft = get().draft;
      if (draft == null) return;
      applyEdit(setIn(draft, path, value));
    },

    editCoreField: (edit) => {
      const draft = get().draft;
      if (draft == null) return;
      applyEdit(setIn(draft, coreEditPath(edit), edit.value));
    },

    addItem: (path, item) => {
      const draft = get().draft;
      if (draft == null) return;
      applyEdit(insertAt(draft, path, item));
    },

    removeItem: (path, index) => {
      const draft = get().draft;
      if (draft == null) return;
      applyEdit(removeAt(draft, path, index));
    },

    setCurrentHp: (value) => mutate((c) => setCurrentHp(c, value)),
    setTempHp: (value) => mutate((c) => setTempHp(c, value)),
    damage: (amount) => mutate((c) => damage(c, amount)),
    heal: (amount) => mutate((c) => heal(c, amount)),
    adjustResource: (id, delta) => mutate((c) => adjustResource(c, id, delta)),
    adjustHitDice: (delta) => mutate((c) => adjustHitDice(c, delta)),

    runAction: (id) => {
      if (get().versionBusy) return;
      const c = get().character;
      if (!c) return;
      const action = c.actions.find((a) => a.id === id);
      if (!action) return;
      const { character, changes, errors, rolls, faces } = applyAction(c, action.formulas, deps.makeRng(deps.now()));
      notify(deps, action.label || action.id, c, changes, rolls, errors);
      if (faces.length) deps.presentDice(faces);
      if (changes.length > 0) {
        const draft = get().draft;
        if (draft != null) {
          const next = clearDeathOnRevive(c, character);
          commitDraft(patchDraftFromProjection(c, next, draft));
        }
      }
    },

    shortRest: () => doRest("shortRest"),
    longRest: () => doRest("longRest"),

    setItemQuantity: (index, quantity) => mutate((c) => setItemQuantity(c, index, quantity)),
    toggleEquipped: (index) => mutate((c) => toggleEquipped(c, index)),
    setCurrency: (code, value) => mutate((c) => setCurrency(c, code, value)),
    addCondition: (name) => mutate((c) => addCondition(c, name)),
    removeCondition: (name) => mutate((c) => removeCondition(c, name)),
    toggleInspiration: () => mutate(toggleInspiration),
    setDeathSave: (kind, value) => mutate((c) => setDeathSave(c, kind, value)),
    };
  });
}
