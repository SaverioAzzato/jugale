import { describe, it, expect } from "vitest";
import { getIn, setIn, insertAt, removeAt } from "./edit";

describe("edit — immutable path helpers", () => {
  it("getIn reads nested values and returns undefined past a missing step", () => {
    const o = { a: { b: [{ c: 1 }, { c: 2 }] } };
    expect(getIn(o, ["a", "b", 1, "c"])).toBe(2);
    expect(getIn(o, ["a", "x", "y"])).toBeUndefined();
  });

  it("setIn replaces a leaf without mutating the source", () => {
    const o = { meta: { name: "old" }, combat: { hp: { max: 10 } } };
    const next = setIn(o, ["combat", "hp", "max"], 25);
    expect(next.combat.hp.max).toBe(25);
    expect(o.combat.hp.max).toBe(10); // original untouched
    expect(next.meta).toBe(o.meta); // untouched branches shared by reference
  });

  it("setIn writes into an array entry by index", () => {
    const o = { resources: [{ id: "a", current: 1 }, { id: "b", current: 2 }] };
    const next = setIn(o, ["resources", 1, "current"], 9);
    expect(next.resources[1].current).toBe(9);
    expect(o.resources[1].current).toBe(2);
    expect(next.resources[0]).toBe(o.resources[0]);
  });

  it("setIn creates a missing object node on the way down", () => {
    const next = setIn({} as Record<string, unknown>, ["a", "b"], 1);
    expect(getIn(next, ["a", "b"])).toBe(1);
  });

  it("insertAt appends by default and inserts at an index when given", () => {
    const o = { list: [1, 2] };
    expect(insertAt(o, ["list"], 3).list).toEqual([1, 2, 3]);
    expect(insertAt(o, ["list"], 0, 0).list).toEqual([0, 1, 2]);
    expect(o.list).toEqual([1, 2]); // source untouched
  });

  it("insertAt seeds an array when the path is empty/absent", () => {
    const next = insertAt({} as { list?: number[] }, ["list"], 1);
    expect(next.list).toEqual([1]);
  });

  it("removeAt drops the entry at the index", () => {
    const o = { list: ["a", "b", "c"] };
    expect(removeAt(o, ["list"], 1).list).toEqual(["a", "c"]);
    expect(o.list).toEqual(["a", "b", "c"]);
  });
});
