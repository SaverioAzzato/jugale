import type { AbilityId, Character } from "../schema";
import { abilityModifierFor, proficiencyBonus, totalLevel, maxHitDice } from "../schema";

/**
 * A tiny, safe formula engine for character "actions" (rest perks, custom buttons).
 * A formula is `path = expression`, e.g.
 *   combat.hp.current = combat.hp.current + abilities.con.mod + 1d8
 *
 * The right-hand side is a sum/difference of terms; each term is a number, a dice
 * roll (`NdM` / `dM`), or a readable path. No eval, no arbitrary code — only `+`/`-`
 * over a fixed token grammar. Paths address the character object; array entries
 * (resources, items) are addressed by their `id`. A few read-only virtual paths are
 * also available: `level`, `pb`/`proficiency`, `maxHitDice`, `abilities.<id>.mod`.
 */

export type Rng = () => number;

/** Deterministic PRNG (mulberry32). Seed with a timestamp for effectively-random rolls. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ABILITY_MOD = /^abilities\.(str|dex|con|int|wis|cha)\.mod$/;

/** Read-only derived paths — valid on the right side, never a write target. */
function isVirtual(path: string): boolean {
  return path === "level" || path === "pb" || path === "proficiency" || path === "maxHitDice" || ABILITY_MOD.test(path);
}

/** Read a numeric value from the character by path (incl. virtual/derived paths). */
export function getByPath(c: Character, path: string): number | undefined {
  if (path === "level") return totalLevel(c);
  if (path === "pb" || path === "proficiency") return proficiencyBonus(c);
  if (path === "maxHitDice") return maxHitDice(c);
  const abil = path.match(ABILITY_MOD);
  if (abil) return abilityModifierFor(c, abil[1] as AbilityId);

  const segs = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = c;
  for (const seg of segs) {
    if (cur == null) return undefined;
    cur = Array.isArray(cur) ? cur.find((el) => el?.id === seg) : cur[seg];
  }
  return typeof cur === "number" ? cur : undefined;
}

/** Immutably set a numeric value at a path (arrays addressed by entry `id`). */
export function setByPath(c: Character, path: string, value: number): Character {
  const segs = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (node: any, i: number): any => {
    const seg = segs[i];
    if (i === segs.length - 1) {
      return Array.isArray(node) ? node : { ...node, [seg]: value };
    }
    if (Array.isArray(node)) {
      return node.map((el) => (el?.id === seg ? walk(el, i + 1) : el));
    }
    return { ...node, [seg]: walk(node?.[seg], i + 1) };
  };
  return walk(c, 0) as Character;
}

function rollDice(n: number, sides: number, rng: Rng): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += 1 + Math.floor(rng() * sides);
  return sum;
}

function evalTerm(c: Character, term: string, rng: Rng, errors?: string[]): number {
  if (/^\d+$/.test(term)) return Number(term);
  const dice = term.match(/^(\d*)d(\d+)$/i);
  if (dice) return rollDice(Number(dice[1] || "1"), Number(dice[2]), rng);
  const v = getByPath(c, term);
  if (v === undefined) {
    errors?.push(`unknown reference "${term}"`);
    return 0;
  }
  return v;
}

/** Evaluate the right-hand side: a +/- sum of numbers, dice, and paths.
 *  Pass `errors` to collect unresolved references (strict mode). */
export function evalExpression(c: Character, expr: string, rng: Rng, errors?: string[]): number {
  const tokens = expr.match(/[+-]?\s*[^+-]+/g) ?? [];
  let total = 0;
  for (const raw of tokens) {
    let tk = raw.trim();
    let sign = 1;
    if (tk.startsWith("+")) tk = tk.slice(1).trim();
    else if (tk.startsWith("-")) {
      sign = -1;
      tk = tk.slice(1).trim();
    }
    if (tk) total += sign * evalTerm(c, tk, rng, errors);
  }
  return total;
}

/** Keep the well-known live fields within their valid range. */
function clampForPath(c: Character, path: string, value: number): number {
  if (path === "combat.hp.current") return Math.max(0, Math.min(value, c.combat.hp.max || value));
  if (path === "combat.hp.temp") return Math.max(0, value);
  if (path === "combat.hp.hitDiceRemaining") return Math.max(0, Math.min(value, maxHitDice(c)));
  const res = path.match(/^resources\.([^.]+)\.current$/);
  if (res) {
    const r = c.resources.find((x) => x.id === res[1]);
    if (r) return Math.max(0, Math.min(value, r.max));
  }
  return value;
}

/** Apply one `path = expr` formula, returning the updated character. Invalid → unchanged. */
export function applyFormula(c: Character, formula: string, rng: Rng): Character {
  const eq = formula.indexOf("=");
  if (eq < 0) return c;
  const lhs = formula.slice(0, eq).trim();
  const rhs = formula.slice(eq + 1).trim();
  if (!lhs || !rhs) return c;
  const value = clampForPath(c, lhs, Math.round(evalExpression(c, rhs, rng)));
  return setByPath(c, lhs, value);
}

/** Apply every formula of an action in sequence. */
export function applyFormulas(c: Character, formulas: string[], rng: Rng): Character {
  return formulas.reduce((acc, f) => applyFormula(acc, f, rng), c);
}

export interface FormulaChange {
  path: string;
  before: number;
  after: number;
}

export interface FormulaResult {
  character: Character;
  change?: FormulaChange;
  error?: string;
}

/** Strict single-formula apply: reports what changed, or why it couldn't. */
export function evaluateFormula(c: Character, formula: string, rng: Rng): FormulaResult {
  const eq = formula.indexOf("=");
  if (eq < 0) return { character: c, error: `malformed formula "${formula}"` };
  const lhs = formula.slice(0, eq).trim();
  const rhs = formula.slice(eq + 1).trim();
  if (!lhs || !rhs) return { character: c, error: `incomplete formula "${formula}"` };

  if (isVirtual(lhs)) return { character: c, error: `cannot write to derived value "${lhs}"` };
  const before = getByPath(c, lhs);
  if (typeof before !== "number") return { character: c, error: `cannot write to "${lhs}"` };

  const errors: string[] = [];
  const value = clampForPath(c, lhs, Math.round(evalExpression(c, rhs, rng, errors)));
  if (errors.length > 0) return { character: c, error: errors[0] };

  return { character: setByPath(c, lhs, value), change: { path: lhs, before, after: value } };
}

/** Run an action's formulae, collecting the changes made and any errors. */
export function applyAction(
  c: Character,
  formulas: string[],
  rng: Rng,
): { character: Character; changes: FormulaChange[]; errors: string[] } {
  let cur = c;
  const changes: FormulaChange[] = [];
  const errors: string[] = [];
  for (const f of formulas) {
    const r = evaluateFormula(cur, f, rng);
    if (r.error) errors.push(r.error);
    if (r.change) {
      cur = r.character;
      changes.push(r.change);
    }
  }
  return { character: cur, changes, errors };
}
