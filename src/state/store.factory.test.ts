import { describe, expect, it, vi } from "vitest";
import { makeRng } from "../model/formula";
import { createCharacterStore, type CharacterStoreDependencies } from "./store";

function dependencies(overrides: Partial<CharacterStoreDependencies> = {}): CharacterStoreDependencies {
  return {
    now: () => 123,
    makeRng,
    schedule: () => 1 as unknown as ReturnType<typeof setTimeout>,
    cancelScheduled: () => {},
    t: (key) => key,
    toast: { push: vi.fn() },
    presentDice: vi.fn(),
    versionHistoryEnabled: () => false,
    exportDocument: vi.fn(async () => true),
    ...overrides,
  };
}

describe("createCharacterStore", () => {
  it("creates isolated instances", () => {
    const first = createCharacterStore(dependencies());
    const second = createCharacterStore(dependencies());
    first.getState().loadRaw({ meta: { name: "First" }, combat: { hp: { max: 10, current: 10 } } });
    second.getState().loadRaw({ meta: { name: "Second" }, combat: { hp: { max: 10, current: 10 } } });

    first.getState().damage(2);

    expect(first.getState().character?.combat.hp.current).toBe(8);
    expect(second.getState().character?.combat.hp.current).toBe(10);
  });

  it("routes export through the injected port", async () => {
    const exportDocument = vi.fn(async () => true);
    const store = createCharacterStore(dependencies({ exportDocument }));
    store.getState().loadRaw({ meta: { name: "Port Hero" }, unknown: "kept" });

    await store.getState().exportCharacter();

    expect(exportDocument).toHaveBeenCalledWith(
      { meta: { name: "Port Hero" }, unknown: "kept" },
      "port-hero.json",
    );
  });
});
