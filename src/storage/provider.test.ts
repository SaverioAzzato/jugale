import { beforeAll, describe, expect, it } from "vitest";
import { importCharacterFolder, NO_CHARACTER_JSON } from "./provider";

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
