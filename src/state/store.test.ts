import { describe, it, expect, beforeEach } from "vitest";
import { useCharacter } from "./store";
import multiclass from "../../characters/example-multiclass/character.json";

const c = () => useCharacter.getState().character!;
const res = (id: string) => c().resources.find((r) => r.id === id)!;

describe("store — live play mutations", () => {
  beforeEach(() => useCharacter.getState().loadRaw(multiclass, "test"));

  it("damage drains temp HP first, then current, flooring at 0", () => {
    useCharacter.getState().setTempHp(5);
    useCharacter.getState().damage(8); // 5 temp + 3 current (42 → 39)
    expect(c().combat.hp.temp).toBe(0);
    expect(c().combat.hp.current).toBe(39);
    useCharacter.getState().damage(999);
    expect(c().combat.hp.current).toBe(0);
  });

  it("heal caps at max HP", () => {
    useCharacter.getState().damage(20);
    useCharacter.getState().heal(100);
    expect(c().combat.hp.current).toBe(c().combat.hp.max);
  });

  it("adjustResource clamps to [0, max]", () => {
    useCharacter.getState().adjustResource("channel-divinity", -5);
    expect(res("channel-divinity").current).toBe(0);
    useCharacter.getState().adjustResource("channel-divinity", 9);
    expect(res("channel-divinity").current).toBe(res("channel-divinity").max);
  });

  it("short rest restores only shortRest resources", () => {
    useCharacter.getState().adjustResource("channel-divinity", -1); // shortRest → 0
    useCharacter.getState().adjustResource("spell-slots-1", -2); // longRest, 4 → 2
    useCharacter.getState().shortRest();
    expect(res("channel-divinity").current).toBe(1);
    expect(res("spell-slots-1").current).toBe(2);
  });

  it("long rest restores rest-recoverable resources and full HP", () => {
    useCharacter.getState().damage(20);
    useCharacter.getState().adjustResource("spell-slots-1", -3);
    useCharacter.getState().longRest();
    expect(c().combat.hp.current).toBe(c().combat.hp.max);
    expect(res("spell-slots-1").current).toBe(4);
  });

  it("inventory quantity (by index) and currencies never go negative", () => {
    useCharacter.getState().setItemQuantity(0, 7);
    expect(c().inventory.items[0].quantity).toBe(7);
    useCharacter.getState().setCurrency("gp", -10);
    expect(c().inventory.currencies.gp).toBe(0);
  });

  it("marks the character dirty after an edit", () => {
    expect(useCharacter.getState().dirty).toBe(false);
    useCharacter.getState().heal(1);
    expect(useCharacter.getState().dirty).toBe(true);
  });
});
