import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import multiclass from "../../characters/example-multiclass/character.json";
import type { StorageProvider } from "../storage/provider";
import type { VersionStore } from "../storage/versions";
import { useSettings } from "../ui/useSettings";
import { useCharacter } from "../characterStore";

const invalidDraft = {
  ...multiclass,
  meta: {
    ...multiclass.meta,
    name: "Half-edited hero",
    nestedUnknown: { keep: "nested-meta" },
  },
  classes: [{ ...multiclass.classes[0], level: "five", classUnknown: "keep-array-entry" }],
  homebrew: { keep: "top-level" },
};

function providerWith(write = vi.fn(async (_data: unknown) => {})): StorageProvider {
  return { kind: "file", read: vi.fn(async () => multiclass), write };
}

describe("character store — lossless persistence boundary", () => {
  beforeEach(() => {
    useCharacter.getState().clear();
    useSettings.getState().setVersionHistory(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    useCharacter.getState().clear();
  });

  it("does not enqueue a canonical save for a schema-invalid raw-editor draft", async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_data: unknown) => {});
    useCharacter.getState().connect(providerWith(write), multiclass, "live.json");

    useCharacter.getState().setRawJson(invalidDraft);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(write).not.toHaveBeenCalled();
    expect((useCharacter.getState() as unknown as { draft: unknown }).draft).toEqual(invalidDraft);
    expect(useCharacter.getState().issues.some((issue) => issue.severity === "error")).toBe(true);
  });

  it("does not write a fallback after opening an invalid external file and receiving a live edit", async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_data: unknown) => {});
    useCharacter.getState().connect(providerWith(write), invalidDraft, "broken-live.json");

    useCharacter.getState().heal(1);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(write).not.toHaveBeenCalled();
    expect((useCharacter.getState() as unknown as { draft: unknown }).draft).toEqual(invalidDraft);
  });

  it("saves the next corrected draft exactly once and never writes the fallback", async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_data: unknown) => {});
    useCharacter.getState().connect(providerWith(write), multiclass, "live.json");

    useCharacter.getState().setRawJson(invalidDraft);
    await vi.advanceTimersByTimeAsync(1_000);
    const corrected = {
      ...invalidDraft,
      classes: [{ ...multiclass.classes[0], level: 5, classUnknown: "keep-array-entry" }],
    };
    useCharacter.getState().setRawJson(corrected);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ document: corrected }));
  });

  it("opens a future-schema file read-only and never rewrites it", async () => {
    vi.useFakeTimers();
    const write = vi.fn(async (_data: unknown) => {});
    const future = {
      ...multiclass,
      schemaVersion: "9.0.0",
      futureSection: { unknownMechanic: [1, 2, 3] },
    };
    useCharacter.getState().connect(providerWith(write), future, "future.json");

    expect(useCharacter.getState()).toMatchObject({
      draft: future,
      liveSync: false,
      readOnly: true,
      dirty: false,
      validation: { kind: "future-schema", schemaVersion: "9.0.0" },
    });
    useCharacter.getState().damage(1);
    useCharacter.getState().setRawJson({ ...future, schemaVersion: "2.2.0" });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(write).not.toHaveBeenCalled();
    expect(useCharacter.getState().draft).toEqual(future);
  });

  it("preserves known and unknown data across open, edit, save and reload", async () => {
    let disk: unknown = structuredClone({
      ...multiclass,
      meta: { ...multiclass.meta, nestedUnknown: { campaign: "red-moon" } },
      resources: multiclass.resources.map((resource, index) =>
        index === 0 ? { ...resource, resourceUnknown: { source: "homebrew" } } : resource,
      ),
      homebrew: { topLevel: [1, 2, 3] },
    });
    const provider: StorageProvider = {
      kind: "file",
      read: vi.fn(async () => structuredClone(disk)),
      write: vi.fn(async (data) => { disk = structuredClone(data.document); }),
    };
    useCharacter.getState().connect(provider, await provider.read(), "live.json");

    useCharacter.getState().editField(["combat", "hp", "current"], 7);
    await expect(useCharacter.getState().flushPendingSave()).resolves.toBe(true);
    useCharacter.getState().connect(provider, await provider.read(), "live.json");

    const reloaded = useCharacter.getState().character as unknown as Record<string, unknown>;
    expect(useCharacter.getState().character?.combat.hp.current).toBe(7);
    expect(reloaded.homebrew).toEqual({ topLevel: [1, 2, 3] });
    expect((useCharacter.getState().character?.meta as unknown as Record<string, unknown>).nestedUnknown)
      .toEqual({ campaign: "red-moon" });
    expect((useCharacter.getState().character?.resources[0] as unknown as Record<string, unknown>).resourceUnknown)
      .toEqual({ source: "homebrew" });
  });

  it("rejects a schema-invalid import before snapshotting or writing", async () => {
    const write = vi.fn(async (_data: unknown) => {});
    const create = vi.fn(async () => ({
      id: "character-20260803-120000-000-before-import.json",
      filename: "character-20260803-120000-000-before-import.json",
      createdAt: "2026-08-03T10:00:00.000Z",
      reason: "before-import" as const,
    }));
    const versions: VersionStore = {
      create,
      list: vi.fn(async () => []),
      read: vi.fn(async () => multiclass),
      delete: vi.fn(async () => {}),
    };
    useSettings.getState().setVersionHistory(true);
    useCharacter.getState().connect({ ...providerWith(write), versions }, multiclass, "folder");

    await expect(useCharacter.getState().replaceCharacter(invalidDraft, "before-import")).resolves.toBe(false);

    expect(create).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(useCharacter.getState().character?.meta.name).toBe(multiclass.meta.name);
  });

  it("rejects a schema-invalid restore without modifying the destination", async () => {
    const write = vi.fn(async (_data: unknown) => {});
    const create = vi.fn(async () => ({
      id: "character-20260803-120000-000-before-restore.json",
      filename: "character-20260803-120000-000-before-restore.json",
      createdAt: "2026-08-03T10:00:00.000Z",
      reason: "before-restore" as const,
    }));
    const versions: VersionStore = {
      create,
      list: vi.fn(async () => []),
      read: vi.fn(async () => invalidDraft),
      delete: vi.fn(async () => {}),
    };
    useCharacter.getState().connect({ ...providerWith(write), versions }, multiclass, "folder");

    await expect(useCharacter.getState().replaceCharacter(invalidDraft, "before-restore", true)).resolves.toBe(false);

    expect(create).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(useCharacter.getState().character?.meta.name).toBe(multiclass.meta.name);
  });
});
