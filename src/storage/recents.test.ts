import { describe, it, expect } from "vitest";
import { mergeRecent, refKey, type RecentEntry } from "./recents";

const entry = (over: Partial<RecentEntry>): RecentEntry => ({
  platform: "web",
  kind: "folder",
  name: "alpha",
  key: "web:folder:alpha",
  lastOpenedAt: 1,
  ...over,
});

describe("refKey", () => {
  it("keys native refs by path and web refs by name", () => {
    expect(refKey({ platform: "tauri", kind: "folder", name: "alpha", path: "/p/alpha" })).toBe("tauri:folder:/p/alpha");
    expect(refKey({ platform: "web", kind: "file", name: "character.json" })).toBe("web:file:character.json");
  });

  it("keys snapshot refs by name (distinct from live refs)", () => {
    expect(refKey({ platform: "snapshot", kind: "folder", name: "alpha" })).toBe("snapshot:folder:alpha");
  });
});

describe("mergeRecent", () => {
  it("prepends a new entry, newest first", () => {
    const a = entry({ key: "a", name: "a", lastOpenedAt: 1 });
    const b = entry({ key: "b", name: "b", lastOpenedAt: 2 });
    const out = mergeRecent([a], b);
    expect(out.map((e) => e.key)).toEqual(["b", "a"]);
  });

  it("de-dupes by key and refreshes the timestamp instead of duplicating", () => {
    const old = entry({ key: "x", lastOpenedAt: 1 });
    const fresh = entry({ key: "x", lastOpenedAt: 5 });
    const out = mergeRecent([old, entry({ key: "y", lastOpenedAt: 2 })], fresh);
    expect(out.filter((e) => e.key === "x")).toHaveLength(1);
    expect(out[0].key).toBe("x");
    expect(out[0].lastOpenedAt).toBe(5);
  });

  it("caps the list at the max, dropping the oldest", () => {
    const list = Array.from({ length: 8 }, (_, i) => entry({ key: `k${i}`, lastOpenedAt: i + 1 }));
    const out = mergeRecent(list, entry({ key: "new", lastOpenedAt: 100 }), 8);
    expect(out).toHaveLength(8);
    expect(out[0].key).toBe("new");
    expect(out.some((e) => e.key === "k0")).toBe(false); // oldest evicted
  });
});
