import { beforeEach, describe, expect, it, vi } from "vitest";

const { writes, mkdirMock, removeMock, historyFiles } = vi.hoisted(() => {
  const historyFiles = new Map<string, string>();
  return {
    writes: vi.fn(async (_path: string, _value: string) => {}),
    mkdirMock: vi.fn(async () => {}),
    removeMock: vi.fn(async (path: string) => { historyFiles.delete(path.split("/").pop() || ""); }),
    historyFiles,
  };
});

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async (options: { directory?: boolean }) =>
    options.directory ? "/hero" : "/hero/character.json",
  ),
  save: vi.fn(async () => null),
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
}));

import { openCharacterFileTauri, openCharacterFolderTauri } from "./tauriProvider";

beforeEach(() => {
  writes.mockClear();
  mkdirMock.mockClear();
  removeMock.mockClear();
  historyFiles.clear();
  historyFiles.set(
    "character-20260727-153012-184-checkpoint.json",
    JSON.stringify({ meta: { name: "Old hero" } }),
  );
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
      `/hero/history/${created.filename}`,
      JSON.stringify({ meta: { name: "Hero" } }, null, 2),
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

    const file = await openCharacterFileTauri();
    expect(file!.provider.versions).toBeUndefined();
  });
});
