import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the native SAF plugin: an in-memory folder with character.json + two images.
// Everything the vi.mock factory needs is created via vi.hoisted (the factory is hoisted
// above normal top-level consts, so it can't close over them).
const { persist, checkPerm, writeText, TREE, JSON_URI } = vi.hoisted(() => {
  const TREE = { uri: "content://tree/PG", documentTopTreeUri: "content://tree/PG" };
  const JSON_URI = { uri: "content://doc/character.json", documentTopTreeUri: TREE.uri };
  return {
    TREE,
    JSON_URI,
    persist: vi.fn(async () => {}),
    checkPerm: vi.fn(async () => true),
    writeText: vi.fn(async () => {}),
  };
});

vi.mock("tauri-plugin-android-fs-api", () => {
  const IMAGES_DIR = { uri: "content://doc/images", documentTopTreeUri: TREE.uri };
  const IMG_A = { uri: "content://doc/img-a", documentTopTreeUri: TREE.uri };
  const IMG_B = { uri: "content://doc/img-b", documentTopTreeUri: TREE.uri };
  return {
    AndroidUriPermissionState: { Read: "Read", Write: "Write", ReadAndWrite: "ReadAndWrite", ReadOrWrite: "ReadOrWrite" },
    AndroidFs: {
      showOpenDirPicker: vi.fn(async () => TREE),
      showOpenFilePicker: vi.fn(async () => [JSON_URI]),
      persistPickerUriPermission: persist,
      checkPersistedPickerUriPermission: checkPerm,
      getName: vi.fn(async () => "PG"),
      readTextFile: vi.fn(async () => JSON.stringify({ meta: { name: "Astrid" } })),
      writeTextFile: writeText,
      readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
      readDir: vi.fn(async (uri: { uri: string }) => {
        if (uri.uri === TREE.uri)
          return [
            { type: "File", name: "character.json", uri: JSON_URI },
            { type: "Dir", name: "images", uri: IMAGES_DIR },
          ];
        // images/ — returned out of order to prove alphabetical sorting
        return [
          { type: "File", name: "02-b.png", uri: IMG_B },
          { type: "File", name: "01-a.png", uri: IMG_A },
        ];
      }),
    },
  };
});

import { openCharacterFolderAndroid, openCharacterFileAndroid, reopenAndroid } from "./androidProvider";

beforeEach(() => {
  persist.mockClear();
  checkPerm.mockClear();
  writeText.mockClear();
  // jsdom lacks createObjectURL
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
});

describe("openCharacterFolderAndroid", () => {
  it("persists the tree permission, reads character.json, and sorts images", async () => {
    const res = await openCharacterFolderAndroid();
    expect(res).not.toBeNull();
    expect(persist).toHaveBeenCalledWith(TREE); // survives restarts → recents reopen
    expect(res!.sourceName).toBe("PG");
    expect(res!.raw).toEqual({ meta: { name: "Astrid" } });
    expect(res!.images.map((i) => i.name)).toEqual(["images/01-a.png", "images/02-b.png"]);
    expect(res!.ref).toMatchObject({ platform: "android", kind: "folder", uri: TREE });
  });

  it("writes back in place to the character.json URI (single source of truth)", async () => {
    const res = await openCharacterFolderAndroid();
    await res!.provider.write({ meta: { name: "Edited" } });
    expect(writeText).toHaveBeenCalledWith(JSON_URI, JSON.stringify({ meta: { name: "Edited" } }, null, 2));
  });
});

describe("openCharacterFileAndroid", () => {
  it("persists the file permission and records an android file ref", async () => {
    const res = await openCharacterFileAndroid();
    expect(persist).toHaveBeenCalledWith(JSON_URI);
    expect(res!.ref).toMatchObject({ platform: "android", kind: "file", uri: JSON_URI });
  });
});

describe("reopenAndroid", () => {
  it("re-resolves a folder when the persisted permission is still granted", async () => {
    const loaded = await reopenAndroid({ platform: "android", kind: "folder", name: "PG", uri: TREE });
    expect(checkPerm).toHaveBeenCalledWith(TREE, "ReadOrWrite");
    expect(loaded.raw).toEqual({ meta: { name: "Astrid" } });
    expect(loaded.images).toHaveLength(2);
  });

  it("throws when the persisted permission was lost", async () => {
    checkPerm.mockResolvedValueOnce(false);
    await expect(
      reopenAndroid({ platform: "android", kind: "folder", name: "PG", uri: TREE }),
    ).rejects.toThrow();
  });
});
