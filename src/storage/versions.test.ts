import { describe, expect, it, vi } from "vitest";
import {
  allocateVersion,
  createVersionStore,
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

describe("shared version-store policy", () => {
  const memoryStorage = () => {
    const files = new Map<string, string>();
    return {
      files,
      storage: {
        listNames: vi.fn(async () => [...files.keys()]),
        readText: vi.fn(async (filename: string) => {
          const value = files.get(filename);
          if (value === undefined) throw new Error("missing");
          return value;
        }),
        writeText: vi.fn(async (filename: string, contents: string) => { files.set(filename, contents); }),
        remove: vi.fn(async (filename: string) => {
          if (!files.delete(filename)) throw new Error("missing");
        }),
      },
    };
  };

  it("creates, lists, reads and deletes through host primitives", async () => {
    const { files, storage } = memoryStorage();
    const store = createVersionStore(storage);
    const version = await store.create(
      { meta: { name: "Hero" } },
      "checkpoint",
      " Before dragon ",
      new Date(2026, 6, 27, 15, 30, 12, 184),
    );

    expect(await store.list()).toEqual([version]);
    expect(await store.read(version)).toEqual({ meta: { name: "Hero" } });
    await store.delete(version);
    expect(files.size).toBe(0);
  });

  it("keeps a successful snapshot when its optional title sidecar fails", async () => {
    const { files, storage } = memoryStorage();
    storage.writeText.mockImplementation(async (filename, contents) => {
      if (filename.endsWith(".meta.json")) throw new Error("sidecar denied");
      files.set(filename, contents);
    });
    const store = createVersionStore(storage);

    const version = await store.create({}, "checkpoint", "Optional title", new Date(2026, 0, 1));

    expect(version.title).toBeUndefined();
    expect(files.has(version.filename)).toBe(true);
    expect(await store.read(version)).toEqual({});
  });

  it("does not report snapshot deletion as failed when only sidecar cleanup fails", async () => {
    const { files, storage } = memoryStorage();
    const store = createVersionStore(storage);
    const version = await store.create({}, "checkpoint", "Title", new Date(2026, 0, 1));
    storage.remove.mockImplementation(async (filename) => {
      if (filename.endsWith(".meta.json")) throw new Error("sidecar locked");
      files.delete(filename);
    });

    await expect(store.delete(version)).resolves.toBeUndefined();
    expect(files.has(version.filename)).toBe(false);
  });
});
