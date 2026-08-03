import { describe, expect, it, vi } from "vitest";
import { loadCharacter } from "../schema";
import type { StorageProvider } from "../storage/provider";
import { createPersistenceCoordinator, type PersistenceState } from "./persistenceCoordinator";

function harness(raw: unknown = { meta: { name: "Hero" } }) {
  const loaded = loadCharacter(raw);
  const write = vi.fn(async () => {});
  const provider = { kind: "file", read: async () => raw, write } satisfies StorageProvider;
  let state: PersistenceState = {
    provider,
    liveSync: true,
    readOnly: false,
    draft: loaded.draft,
    lastPersisted: null,
    validation: loaded.validation,
    dirty: true,
    saveError: "old",
  };
  let scheduled: (() => void) | null = null;
  const coordinator = createPersistenceCoordinator({
    get: () => state,
    set: (patch) => { state = { ...state, ...patch }; },
    reportFailure: (_provider, error) => {
      state = { ...state, liveSync: false, readOnly: true, saveError: String(error) };
    },
    schedule: (callback) => {
      scheduled = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    cancelScheduled: vi.fn(),
  });
  return { coordinator, getState: () => state, provider, runScheduled: () => scheduled?.(), write };
}

describe("persistence coordinator", () => {
  it("debounces a write and clears dirty only after the exact draft succeeds", async () => {
    const h = harness();
    h.coordinator.schedule();
    h.runScheduled();
    await vi.waitFor(() => expect(h.write).toHaveBeenCalledTimes(1));
    expect(h.getState()).toMatchObject({ dirty: false, saveError: null });
    expect(h.getState().lastPersisted).toEqual({ meta: { name: "Hero" } });
  });

  it("fails closed without calling write for a schema-invalid draft", async () => {
    const h = harness({ meta: { name: "Hero" }, classes: 5 });
    await expect(h.coordinator.flush()).resolves.toBe(false);
    expect(h.write).not.toHaveBeenCalled();
    expect(h.getState().dirty).toBe(true);
  });

  it("reports a write failure and leaves the draft dirty for recovery", async () => {
    const h = harness();
    h.write.mockRejectedValueOnce(new Error("denied"));
    await expect(h.coordinator.flush()).resolves.toBe(false);
    expect(h.getState()).toMatchObject({ dirty: true, liveSync: false, readOnly: true });
  });
});
