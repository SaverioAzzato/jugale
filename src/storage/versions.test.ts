import { describe, expect, it } from "vitest";
import {
  allocateVersion,
  normalizeVersionTitle,
  parseVersionFilename,
  sortVersionsNewestFirst,
  versionFilename,
  versionMetadataFilename,
} from "./versions";

describe("character version filenames", () => {
  it("formats local time with milliseconds and reason", () => {
    const date = new Date(2026, 6, 27, 15, 30, 12, 184);
    expect(versionFilename(date, "checkpoint")).toBe("character-20260727-153012-184-checkpoint.json");
  });

  it("parses supported names and ignores unrelated or impossible dates", () => {
    const parsed = parseVersionFilename("character-20260727-181455-031-before-import.json");
    expect(parsed).toMatchObject({
      id: "character-20260727-181455-031-before-import.json",
      reason: "before-import",
    });
    expect(parseVersionFilename("notes.json")).toBeNull();
    expect(parseVersionFilename("character-20260231-120000-000-checkpoint.json")).toBeNull();
  });

  it("moves forward by one millisecond on a collision", () => {
    const now = new Date(2026, 6, 27, 15, 30, 12, 184);
    const existing = new Set([versionFilename(now, "checkpoint")]);
    expect(allocateVersion(now, "checkpoint", existing).filename).toBe(
      "character-20260727-153012-185-checkpoint.json",
    );
  });

  it("sorts newest first using the filename", () => {
    const older = parseVersionFilename("character-20260727-181455-031-before-import.json")!;
    const newer = parseVersionFilename("character-20260728-090102-442-before-restore.json")!;
    expect(sortVersionsNewestFirst([older, newer])).toEqual([newer, older]);
  });

  it("keeps optional titles in a separate, bounded metadata sidecar", () => {
    const filename = "character-20260727-181455-031-checkpoint.json";
    expect(versionMetadataFilename(filename)).toBe("character-20260727-181455-031-checkpoint.meta.json");
    expect(normalizeVersionTitle("  Before dragon  ")).toBe("Before dragon");
    expect(normalizeVersionTitle("   ")).toBeUndefined();
    expect(normalizeVersionTitle("x".repeat(140))).toHaveLength(120);
  });
});
