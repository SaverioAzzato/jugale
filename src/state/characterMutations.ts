import { isBodyArmor, maxHitDice, type Character } from "../schema";

export const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function patchHp(c: Character, hp: Partial<Character["combat"]["hp"]>): Character {
  return { ...c, combat: { ...c.combat, hp: { ...c.combat.hp, ...hp } } };
}

/** Drop spell material rows with no text, preserving identity when no cleanup is needed. */
export function pruneEmptyMaterials(c: Character): Character {
  let changed = false;
  const spellSections = c.spellSections.map((section) => ({
    ...section,
    entries: section.entries.map((entry) => {
      if (!Array.isArray(entry.materials) || entry.materials.length === 0) return entry;
      const kept = entry.materials.filter((material) => (material.text ?? "").trim() !== "");
      if (kept.length === entry.materials.length) return entry;
      changed = true;
      return { ...entry, materials: kept };
    }),
  }));
  return changed ? { ...c, spellSections } : c;
}

/** Regaining HP from 0 clears death saves, so a later death starts fresh. */
export function clearDeathOnRevive(before: Character, after: Character): Character {
  const deathSaves = after.session.deathSaves;
  if (
    before.combat.hp.current <= 0 &&
    after.combat.hp.current > 0 &&
    (deathSaves.successes > 0 || deathSaves.failures > 0)
  ) {
    return {
      ...after,
      session: { ...after.session, deathSaves: { ...deathSaves, successes: 0, failures: 0 } },
    };
  }
  return after;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Copy only changed projection fields into the lossless draft, retaining unknown keys. */
export function patchDraftFromProjection(before: unknown, after: unknown, draft: unknown): unknown {
  if (Object.is(before, after)) return draft;
  if (Array.isArray(before) && Array.isArray(after) && Array.isArray(draft)) {
    if (before.length !== after.length) return after;
    return after.map((value, index) => patchDraftFromProjection(before[index], value, draft[index]));
  }
  if (isRecord(before) && isRecord(after)) {
    const next: Record<string, unknown> = isRecord(draft) ? { ...draft } : {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!(key in after)) delete next[key];
      else if (!Object.is(before[key], after[key])) {
        next[key] = patchDraftFromProjection(before[key], after[key], isRecord(draft) ? draft[key] : undefined);
      }
    }
    return next;
  }
  return after;
}

export const setCurrentHp = (c: Character, value: number) =>
  patchHp(c, { current: Math.max(0, Math.floor(value) || 0) });

export const setTempHp = (c: Character, value: number) =>
  patchHp(c, { temp: Math.max(0, Math.floor(value) || 0) });

export function damage(c: Character, amount: number): Character {
  const fromTemp = Math.min(c.combat.hp.temp, amount);
  return patchHp(c, {
    temp: c.combat.hp.temp - fromTemp,
    current: Math.max(0, c.combat.hp.current - (amount - fromTemp)),
  });
}

export function heal(c: Character, amount: number): Character {
  const cap = c.combat.hp.max > 0 ? c.combat.hp.max : c.combat.hp.current + amount;
  return patchHp(c, { current: Math.min(cap, c.combat.hp.current + amount) });
}

export const adjustResource = (c: Character, id: string, delta: number): Character => ({
  ...c,
  resources: c.resources.map((resource) =>
    resource.id === id
      ? { ...resource, current: clamp(resource.current + delta, 0, resource.max) }
      : resource),
});

export const adjustHitDice = (c: Character, delta: number): Character =>
  patchHp(c, { hitDiceRemaining: clamp(c.combat.hp.hitDiceRemaining + delta, 0, maxHitDice(c)) });

export const setItemQuantity = (c: Character, index: number, quantity: number): Character => ({
  ...c,
  inventory: {
    ...c.inventory,
    items: c.inventory.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, quantity: Math.max(0, quantity) } : item),
  },
});

export function toggleEquipped(c: Character, index: number): Character {
  const target = c.inventory.items[index];
  if (
    target && !target.equipped && isBodyArmor(target) &&
    c.inventory.items.some((item, itemIndex) => itemIndex !== index && item.equipped && isBodyArmor(item))
  ) return c;
  return {
    ...c,
    inventory: {
      ...c.inventory,
      items: c.inventory.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, equipped: !item.equipped } : item),
    },
  };
}

export const setCurrency = (c: Character, code: string, value: number): Character => ({
  ...c,
  inventory: {
    ...c.inventory,
    currencies: { ...c.inventory.currencies, [code]: Math.max(0, value) },
  },
});

export function addCondition(c: Character, name: string): Character {
  const trimmed = name.trim();
  if (!trimmed || c.session.conditions.includes(trimmed)) return c;
  return { ...c, session: { ...c.session, conditions: [...c.session.conditions, trimmed] } };
}

export const removeCondition = (c: Character, name: string): Character => ({
  ...c,
  session: { ...c.session, conditions: c.session.conditions.filter((condition) => condition !== name) },
});

export const toggleInspiration = (c: Character): Character => ({
  ...c,
  session: { ...c.session, inspiration: !c.session.inspiration },
});

export const setDeathSave = (c: Character, kind: "successes" | "failures", value: number): Character => ({
  ...c,
  session: {
    ...c.session,
    deathSaves: { ...c.session.deathSaves, [kind]: clamp(value, 0, 3) },
  },
});
