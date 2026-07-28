import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const names = ["welcome", "play", "attributes", "inventory", "story", "edit", "prompts", "raw-json"];

describe("help screenshots", () => {
  it.each(["en", "it"])("keeps every %s screenshot as a real 2x PNG", (locale) => {
    for (const name of names) {
      const path = resolve("src/help/assets", locale, `${name}.png`);
      const bytes = readFileSync(path);

      expect([...bytes.subarray(0, 8)], `${locale}/${name} must be a PNG`).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(bytes.readUInt32BE(16), `${locale}/${name} width`).toBe(780);
      expect(bytes.readUInt32BE(20), `${locale}/${name} height`).toBe(1688);
    }
  });
});
