import { describe, expect, it } from "vitest";
import multiclass from "../../characters/example-multiclass/character.json";
import { loadCharacter } from "../schema";
import {
  clearDeathOnRevive,
  damage,
  patchDraftFromProjection,
  toggleEquipped,
} from "./characterMutations";

const character = () => loadCharacter(multiclass).character;

describe("character mutations", () => {
  it("applies damage to temporary HP before current HP", () => {
    const before = character();
    const withTemp = {
      ...before,
      combat: { ...before.combat, hp: { ...before.combat.hp, temp: 5 } },
    };

    const after = damage(withTemp, 8);

    expect(after.combat.hp.temp).toBe(0);
    expect(after.combat.hp.current).toBe(withTemp.combat.hp.current - 3);
  });

  it("clears death saves only when a character revives", () => {
    const base = character();
    const before = {
      ...base,
      combat: { ...base.combat, hp: { ...base.combat.hp, current: 0 } },
      session: { ...base.session, deathSaves: { successes: 2, failures: 1 } },
    };
    const after = {
      ...before,
      combat: { ...before.combat, hp: { ...before.combat.hp, current: 1 } },
    };

    expect(clearDeathOnRevive(before, after).session.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(clearDeathOnRevive(after, after)).toBe(after);
  });

  it("patches changed projected values without dropping unknown draft keys", () => {
    const before = { meta: { name: "Before" }, session: { inspiration: false } };
    const after = { meta: { name: "After" }, session: { inspiration: true } };
    const draft = {
      meta: { name: "Before", extension: { kept: true } },
      session: { inspiration: false, pluginState: "preserved" },
      topLevelExtension: 42,
    };

    expect(patchDraftFromProjection(before, after, draft)).toEqual({
      meta: { name: "After", extension: { kept: true } },
      session: { inspiration: true, pluginState: "preserved" },
      topLevelExtension: 42,
    });
  });

  it("does not equip a second body armour", () => {
    const before = character();
    const equippedBodyArmour = before.inventory.items.findIndex(
      (item) => item.category === "armor" && item.equipped,
    );
    expect(equippedBodyArmour).toBeGreaterThanOrEqual(0);
    const candidate = {
      ...before.inventory.items[equippedBodyArmour],
      id: "second-body-armour",
      name: "Second body armour",
      equipped: false,
    };
    const withCandidate = {
      ...before,
      inventory: { ...before.inventory, items: [...before.inventory.items, candidate] },
    };

    expect(toggleEquipped(withCandidate, withCandidate.inventory.items.length - 1)).toBe(withCandidate);
  });
});
