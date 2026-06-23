import { describe, it, expect } from "vitest";
import { CharacterSchema } from "../schema";
import { makeRng, getByPath, setByPath, evalExpression, applyFormula, applyFormulas, evaluateFormula, applyAction } from "./formula";

const c = CharacterSchema.parse({
  meta: { name: "T" },
  classes: [{ name: "Monk", level: 5 }], // PB +3, maxHitDice 5
  abilities: { con: { score: 14 } }, // +2
  combat: { hp: { max: 30, current: 10, temp: 0, hitDiceRemaining: 5 } },
  resources: [{ id: "ki", label: "Ki", max: 5, current: 1, resetOn: "shortRest" }],
});

const lo = () => 0; // each die → 1
const hi = () => 0.999999; // each die → max face

describe("makeRng", () => {
  it("is deterministic for a given seed and varies across calls", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
    const first = makeRng(1)();
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
  });
});

describe("getByPath", () => {
  it("reads stored fields, virtuals, and array-by-id", () => {
    expect(getByPath(c, "combat.hp.current")).toBe(10);
    expect(getByPath(c, "abilities.con.mod")).toBe(2);
    expect(getByPath(c, "pb")).toBe(3);
    expect(getByPath(c, "level")).toBe(5);
    expect(getByPath(c, "maxHitDice")).toBe(5);
    expect(getByPath(c, "resources.ki.current")).toBe(1);
    expect(getByPath(c, "nope.nope")).toBeUndefined();
  });
});

describe("setByPath", () => {
  it("sets nested fields immutably", () => {
    const next = setByPath(c, "combat.hp.current", 25);
    expect(next.combat.hp.current).toBe(25);
    expect(c.combat.hp.current).toBe(10); // original untouched
  });
  it("sets array entries by id", () => {
    const next = setByPath(c, "resources.ki.current", 4);
    expect(next.resources[0].current).toBe(4);
    expect(c.resources[0].current).toBe(1);
  });
});

describe("evalExpression", () => {
  it("sums numbers and paths", () => {
    expect(evalExpression(c, "combat.hp.current + abilities.con.mod + 3", lo)).toBe(15);
    expect(evalExpression(c, "10 - 4", lo)).toBe(6);
  });
  it("rolls dice with the rng", () => {
    expect(evalExpression(c, "2d6", lo)).toBe(2);
    expect(evalExpression(c, "2d6", hi)).toBe(12);
    expect(evalExpression(c, "d8 + 1", lo)).toBe(2);
  });
});

describe("applyFormula", () => {
  it("assigns the evaluated expression to the path", () => {
    const next = applyFormula(c, "combat.hp.temp = abilities.con.mod + 3", lo);
    expect(next.combat.hp.temp).toBe(5);
  });
  it("clamps current HP to max", () => {
    const next = applyFormula(c, "combat.hp.current = combat.hp.current + 100", lo);
    expect(next.combat.hp.current).toBe(30);
  });
  it("clamps a resource to its max", () => {
    const next = applyFormula(c, "resources.ki.current = resources.ki.current + 99", lo);
    expect(next.resources[0].current).toBe(5);
  });
  it("ignores a malformed formula", () => {
    expect(applyFormula(c, "no equals sign", lo)).toBe(c);
  });
});

describe("applyFormulas", () => {
  it("applies formulae in sequence", () => {
    const next = applyFormulas(c, ["combat.hp.current = 20", "combat.hp.current = combat.hp.current + 5"], lo);
    expect(next.combat.hp.current).toBe(25);
  });
});

describe("evaluateFormula (strict, reports changes/errors)", () => {
  it("reports the change for a valid formula", () => {
    const r = evaluateFormula(c, "combat.hp.temp = 4 + 4", lo);
    expect(r.error).toBeUndefined();
    expect(r.change).toEqual({ path: "combat.hp.temp", before: 0, after: 8 });
  });
  it("errors on a malformed formula", () => {
    expect(evaluateFormula(c, "no equals", lo).error).toMatch(/malformed/);
  });
  it("errors when writing to an unknown field", () => {
    expect(evaluateFormula(c, "combat.hp.nope = 5", lo).error).toMatch(/cannot write/);
  });
  it("errors when writing to a derived value", () => {
    expect(evaluateFormula(c, "level = 9", lo).error).toMatch(/derived/);
  });
  it("errors on an unknown reference on the right side", () => {
    expect(evaluateFormula(c, "combat.hp.temp = foo.bar", lo).error).toMatch(/unknown reference/);
  });
});

describe("applyAction", () => {
  it("collects changes and errors across formulae", () => {
    const { character, changes, errors } = applyAction(
      c,
      ["combat.hp.temp = 5", "broken formula", "combat.hp.hitDiceRemaining = combat.hp.hitDiceRemaining - 1"],
      lo,
    );
    expect(character.combat.hp.temp).toBe(5);
    expect(character.combat.hp.hitDiceRemaining).toBe(4);
    expect(changes).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });
});
