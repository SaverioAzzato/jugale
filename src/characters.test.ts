import { describe, it, expect } from "vitest";
import { loadCharacter, totalLevel } from "./schema";
import warlock from "../characters/example-warlock/character.json";
import fighter from "../characters/example-fighter/character.json";
import cleric from "../characters/example-cleric/character.json";
import sorcerer from "../characters/example-sorcerer/character.json";
import multiclass from "../characters/example-multiclass/character.json";

const FIXTURES = { warlock, fighter, cleric, sorcerer, multiclass };

describe("sample characters", () => {
  for (const [name, data] of Object.entries(FIXTURES)) {
    it(`${name} loads cleanly (valid v2, no errors)`, () => {
      const r = loadCharacter(data);
      expect(r.ok).toBe(true);
      expect(r.migrated).toBe(false);
      expect(r.issues.filter((i) => i.severity === "error")).toHaveLength(0);
      expect(totalLevel(r.character)).toBe(5); // every sample is a level-5 build
    });
  }
});
