import { beforeEach, describe, expect, it, vi } from "vitest";

const { writes, mkdirMock, removeMock, renameMock, saveMock, historyFiles } = vi.hoisted(() => {
  const historyFiles = new Map<string, string>();
  return {
    writes: vi.fn(async (_path: string, _value: string) => {}),
    mkdirMock: vi.fn(async () => {}),
    removeMock: vi.fn(async (path: string) => { historyFiles.delete(path.split("/").pop() || ""); }),
    renameMock: vi.fn(async (from: string, to: string) => {
      const fromName = from.split("/").pop() || "";
      const toName = to.split("/").pop() || "";
      const contents = historyFiles.get(fromName);
      if (contents !== undefined) historyFiles.set(toName, contents);
      historyFiles.delete(fromName);
    }),
    saveMock: vi.fn(async () => null as string | null),
    historyFiles,
  };
});

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async (options: { directory?: boolean }) =>
    options.directory ? "/hero" : "/hero/character.json",
  ),
  save: saveMock,
}));

vi.mock("@tauri-apps/api/path", () => ({
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
  basename: vi.fn(async (path: string) => path.split("/").pop() || ""),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) =>
    path === "/hero/character.json" || path === "/hero/history" || historyFiles.has(path.split("/").pop() || "")),
  mkdir: mkdirMock,
  readDir: vi.fn(async (path: string) => {
    if (path === "/hero/images") return [];
    if (path === "/hero/history") {
      return [...historyFiles.keys()].map((name) => ({ name, isFile: true, isDirectory: false, isSymlink: false }));
    }
    return [];
  }),
  readFile: vi.fn(async () => new Uint8Array()),
  readTextFile: vi.fn(async (path: string) => {
    if (path === "/hero/character.json") return JSON.stringify({ meta: { name: "Hero" } });
    return historyFiles.get(path.split("/").pop() || "") || "";
  }),
  writeTextFile: vi.fn(async (path: string, value: string) => {
    writes(path, value);
    if (path.startsWith("/hero/history/")) historyFiles.set(path.split("/").pop()!, value);
  }),
  remove: removeMock,
  rename: renameMock,
}));

import { openCharacterFileTauri, openCharacterFolderTauri, pickCharacterImportTargetTauri } from "./tauriProvider";
import { expectVersionStoreContract } from "../test/versionStoreContract";
import { loadCharacter } from "../schema";

beforeEach(() => {
  writes.mockClear();
  mkdirMock.mockClear();
  removeMock.mockClear();
  renameMock.mockClear();
  saveMock.mockReset();
  saveMock.mockResolvedValue(null);
  historyFiles.clear();
  historyFiles.set(
    "character-20260727-153012-184-checkpoint.json",
    JSON.stringify({ meta: { name: "Old hero" } }),
  );
});

describe("pickCharacterImportTargetTauri", () => {
  it("defers writing character.json in a selected empty folder", async () => {
    const loaded = loadCharacter({ meta: { name: "New" }, extension: { kept: true } });
    if (loaded.validation.kind !== "valid") throw new Error("Expected a persistable fixture");

    const target = await pickCharacterImportTargetTauri();
    expect(target?.kind).toBe("empty");
    expect(writes).not.toHaveBeenCalled();
    if (target?.kind !== "empty") throw new Error("Expected empty target");
    await target.create(loaded.validation.persistable);

    expect(writes).toHaveBeenCalledWith(
      expect.stringMatching(/^\/hero\/character\.json\.jugale-.*\.tmp$/),
      JSON.stringify(loaded.validation.persistable.document, null, 2),
    );
    expect(target.ref).toEqual({ platform: "tauri", kind: "folder", name: "hero", path: "/hero" });
  });
});

describe("Tauri folder version store", () => {
  it("creates, lists and reads history while a single-file provider has no versions", async () => {
    const loaded = await openCharacterFolderTauri();
    const store = loaded!.provider.versions!;
    const created = await store.create(
      { meta: { name: "Hero" } },
      "checkpoint",
      "Before dragon",
      new Date(2026, 6, 27, 15, 30, 12, 184),
    );

    expect(created.filename).toBe("character-20260727-153012-185-checkpoint.json");
    expect(created.title).toBe("Before dragon");
    expect(mkdirMock).toHaveBeenCalledWith("/hero/history", { recursive: true });
    expect(writes).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/hero/history/${created.filename}\\.jugale-.*\\.tmp$`)),
      JSON.stringify({ meta: { name: "Hero" } }, null, 2),
    );
    expect(renameMock).toHaveBeenCalledWith(
      expect.stringContaining(`/hero/history/${created.filename}.jugale-`),
      `/hero/history/${created.filename}`,
    );
    const listed = await store.list();
    expect(listed.map((version) => version.filename)).toEqual([
      created.filename,
      "character-20260727-153012-184-checkpoint.json",
    ]);
    expect(await store.read(listed[1])).toEqual({ meta: { name: "Old hero" } });
    await store.delete(created);
    expect((await store.list()).map((version) => version.filename)).toEqual([
      "character-20260727-153012-184-checkpoint.json",
    ]);
    await expectVersionStoreContract(store, 102);

    const file = await openCharacterFileTauri();
    expect(file!.provider.versions).toBeUndefined();
  });
});
