import { describe, it, expect } from "vitest";
import { parseVersion, isNewer } from "./version";

describe("parseVersion", () => {
  it("strips a leading v and splits three components", () => {
    expect(parseVersion("v1.6.0")).toEqual([1, 6, 0]);
    expect(parseVersion("1.6.0")).toEqual([1, 6, 0]);
  });
  it("ignores pre-release/build suffixes and missing parts", () => {
    expect(parseVersion("2.0.0-beta.1")).toEqual([2, 0, 0]);
    expect(parseVersion("1.5")).toEqual([1, 5, 0]);
  });
});

describe("isNewer", () => {
  it("compares by major, then minor, then patch", () => {
    expect(isNewer("1.6.0", "1.5.0")).toBe(true);
    expect(isNewer("1.5.1", "1.5.0")).toBe(true);
    expect(isNewer("2.0.0", "1.9.9")).toBe(true);
    expect(isNewer("v1.6.0", "v1.6.0")).toBe(false); // same
    expect(isNewer("1.5.0", "1.6.0")).toBe(false); // older
  });
});
