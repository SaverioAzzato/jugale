import { describe, it, expect } from "vitest";
import { CharacterSchema } from "../schema";
import { SKILLS, skillState } from "./skills";

const make = (over: Record<string, unknown>) => CharacterSchema.parse({ meta: { name: "T" }, ...over });

const def = (id: string) => SKILLS.find((s) => s.id === id)!;

describe("skills model", () => {
  it("covers the 18 standard skills", () => {
    expect(SKILLS).toHaveLength(18);
  });

  it("adds proficiency bonus when proficient", () => {
    const c = make({
      classes: [{ name: "Warlock", level: 5 }], // PB +3
      abilities: { int: { score: 12 } }, // +1
      proficiencies: { skills: [{ id: "arcana", proficient: true }] },
    });
    expect(skillState(c, def("arcana")).bonus).toBe(4); // +1 int +3 PB
  });

  it("doubles proficiency for expertise", () => {
    const c = make({
      classes: [{ name: "Bard", level: 5 }],
      abilities: { cha: { score: 16 } }, // +3
      proficiencies: { skills: [{ id: "persuasion", proficient: true, expertise: true }] },
    });
    expect(skillState(c, def("persuasion")).bonus).toBe(9); // +3 +3 +3
  });

  it("falls back to the bare ability modifier when not proficient", () => {
    const c = make({ abilities: { str: { score: 8 } } });
    const s = skillState(c, def("athletics"));
    expect(s.proficient).toBe(false);
    expect(s.bonus).toBe(-1);
  });

  it("matches skill ids loosely (case/punctuation-insensitive)", () => {
    const c = make({ proficiencies: { skills: [{ id: "Sleight_of_Hand", proficient: true }] } });
    expect(skillState(c, def("sleight-of-hand")).proficient).toBe(true);
  });
});
