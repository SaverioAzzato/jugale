import { beforeAll, describe, expect, it } from "vitest";
import { importCharacterFolder, NO_CHARACTER_JSON, openCharacterFile, openCharacterFolder, pickCharacterImportTargetWeb } from "./provider";
import { loadCharacter } from "../schema";
import { expectVersionStoreContract } from "../test/versionStoreContract";

beforeAll(() => {
  // jsdom has no object-URL support; stub it so the loaders can mint blob URLs.
  let n = 0;
  URL.createObjectURL = () => `blob:mock/${n++}`;
  URL.revokeObjectURL = () => {};
});

/** A File carrying a webkitRelativePath, like a folder pick produces. (jsdom's File lacks .text()). */
function fileAt(path: string, content = ""): File {
  const f = new File([content], path.split("/").pop()!, { type: "text/plain" });
  Object.defineProperty(f, "webkitRelativePath", { value: path });
  Object.defineProperty(f, "text", { value: () => Promise.resolve(content) });
  return f;
}

const charJson = (name: string) => JSON.stringify({ meta: { name } });

describe("importCharacterFolder", () => {
  it("parses character.json and lists images/ alphabetically with images/ paths", async () => {
    const files = [
      fileAt("hero/images/03-c.png"),
      fileAt("hero/character.json", charJson("Hero")),
      fileAt("hero/images/01-a.jpg"),
      fileAt("hero/images/02-b.svg"),
    ];
    const { raw, images, sourceName } = await importCharacterFolder(files);
    expect((raw as { meta: { name: string } }).meta.name).toBe("Hero");
    expect(sourceName).toBe("hero");
    expect(images.map((i) => i.name)).toEqual(["images/01-a.jpg", "images/02-b.svg", "images/03-c.png"]);
    expect(images.every((i) => i.url.startsWith("blob:"))).toBe(true);
  });

  it("ignores non-image files and anything nested below images/", async () => {
    const files = [
      fileAt("hero/character.json", charJson("Hero")),
      fileAt("hero/images/01-a.png"),
      fileAt("hero/images/notes.txt"),
      fileAt("hero/images/sub/deep.png"),
    ];
    const { images } = await importCharacterFolder(files);
    expect(images.map((i) => i.name)).toEqual(["images/01-a.png"]);
  });

  it("picks the shallowest character.json so a nested copy can't shadow the root", async () => {
    const files = [
      fileAt("hero/backup/character.json", charJson("Old")),
      fileAt("hero/character.json", charJson("Current")),
    ];
    const { raw } = await importCharacterFolder(files);
    expect((raw as { meta: { name: string } }).meta.name).toBe("Current");
  });

  it("throws NO_CHARACTER_JSON when the folder has none", async () => {
    await expect(importCharacterFolder([fileAt("hero/images/01-a.png")])).rejects.toThrow(NO_CHARACTER_JSON);
  });
});

describe("web folder version store", () => {
  it("is available only through a live folder and creates/lists/reads history JSON", async () => {
    const files = new Map<string, string>([["character.json", charJson("Current")]]);
    const historyFiles = new Map<string, string>();
    const fileHandle = (name: string, bucket: Map<string, string>) => ({
      name,
      getFile: async () => ({ text: async () => bucket.get(name) ?? "" }),
      createWritable: async () => ({
        write: async (text: string) => bucket.set(name, text),
        close: async () => {},
      }),
    });
    const history = {
      name: "history",
      getFileHandle: async (name: string, options?: { create?: boolean }) => {
        if (!historyFiles.has(name) && !options?.create) throw new Error("missing");
        if (!historyFiles.has(name)) historyFiles.set(name, "");
        return fileHandle(name, historyFiles);
      },
      getDirectoryHandle: async () => {
        throw new Error("missing");
      },
      entries: async function* () {
        for (const name of historyFiles.keys()) yield [name, { kind: "file" as const }] as const;
      },
      removeEntry: async (name: string) => { historyFiles.delete(name); },
    };
    const root = {
      name: "hero",
      getFileHandle: async (name: string) => {
        if (!files.has(name)) throw new Error("missing");
        return fileHandle(name, files);
      },
      getDirectoryHandle: async (name: string, options?: { create?: boolean }) => {
        if (name === "history" && (options?.create || historyFiles.size > 0)) return history;
        throw new Error("missing");
      },
      entries: async function* () {},
      removeEntry: async () => {},
    };
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: async () => root });

    const loaded = await openCharacterFolder();
    expect(loaded?.provider.versions).toBeDefined();
    const version = await loaded!.provider.versions!.create(
      { meta: { name: "Current" } },
      "checkpoint",
      "Before dragon",
      new Date(2026, 6, 27, 15, 30, 12, 184),
    );
    expect(version.title).toBe("Before dragon");
    expect(await loaded!.provider.versions!.list()).toEqual([version]);
    expect(await loaded!.provider.versions!.read(version)).toEqual({ meta: { name: "Current" } });
    await expect(
      loaded!.provider.versions!.read({ ...version, filename: "../character.json" }),
    ).rejects.toThrow("Invalid character version filename");
    await loaded!.provider.versions!.delete(version);
    expect(await loaded!.provider.versions!.list()).toEqual([]);
    await expectVersionStoreContract(loaded!.provider.versions!, 101);
  });

  it("does not expose versions when only character.json is opened", async () => {
    const handle = {
      name: "character.json",
      getFile: async () => ({ text: async () => charJson("Single file") }),
      createWritable: async () => ({ write: async () => {}, close: async () => {} }),
    };
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: async () => [handle],
    });
    const loaded = await openCharacterFile();
    expect(loaded!.provider.versions).toBeUndefined();
  });
});

describe("pickCharacterImportTargetWeb", () => {
  it("defers creating character.json in a chosen empty folder", async () => {
    let contents = "";
    let created = false;
    const handle = {
      name: "character.json",
      getFile: async () => ({ text: async () => contents }),
      createWritable: async () => ({
        write: async (value: string) => { contents = value; },
        close: async () => {},
      }),
    };
    const root = {
      name: "imported-hero",
      getFileHandle: async (_name: string, options?: { create?: boolean }) => {
        if (!created && !options?.create) throw new Error("missing");
        created = true;
        return handle;
      },
      getDirectoryHandle: async () => { throw new Error("missing"); },
      entries: async function* () {},
      removeEntry: async () => { created = false; },
    };
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: async () => root });
    const result = loadCharacter({ meta: { name: "Imported" }, extension: { kept: true } });
    if (result.validation.kind !== "valid") throw new Error("Expected valid fixture");

    const target = await pickCharacterImportTargetWeb();
    expect(target?.kind).toBe("empty");
    expect(created).toBe(false);
    if (target?.kind !== "empty") throw new Error("Expected empty target");
    const loaded = await target.create(result.validation.persistable);

    expect(JSON.parse(contents)).toMatchObject({ meta: { name: "Imported" }, extension: { kept: true } });
    expect(target.ref).toMatchObject({ platform: "web", kind: "folder", name: "imported-hero" });
    expect(await loaded.provider.read()).toMatchObject({ meta: { name: "Imported" } });
  });

  it("rejects a non-empty folder without character.json", async () => {
    const root = {
      name: "not-a-character",
      getFileHandle: async () => { throw new Error("missing"); },
      getDirectoryHandle: async () => { throw new Error("missing"); },
      entries: async function* () { yield ["notes.txt", { kind: "file" as const }] as const; },
      removeEntry: async () => {},
    };
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: async () => root });
    await expect(pickCharacterImportTargetWeb()).rejects.toThrow("import-target-not-empty");
  });

  it("reports browsers without writable folder access", async () => {
    Reflect.deleteProperty(window, "showDirectoryPicker");
    await expect(pickCharacterImportTargetWeb()).rejects.toThrow("import-folder-unsupported");
  });
});
