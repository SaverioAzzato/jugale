import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  android: { value: true },
  invoke: vi.fn(),
  addPluginListener: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  addPluginListener: mocks.addPluginListener,
}));
vi.mock("../storage/androidProvider", () => ({ isAndroid: () => mocks.android.value }));

import { listenForCharacterShares, takePendingCharacterShare } from "./incomingCharacterShare";

beforeEach(() => {
  mocks.android.value = true;
  mocks.invoke.mockReset();
  mocks.addPluginListener.mockReset();
});

describe("incoming Android character shares", () => {
  it("takes the cold-start payload from the native pending buffer", async () => {
    const payload = {
      status: "character",
      id: "abc",
      name: "character.json",
      mime: "application/json",
      contents: '{"meta":{"name":"Astrid"}}',
    };
    mocks.invoke.mockResolvedValue(payload);
    await expect(takePendingCharacterShare()).resolves.toEqual(payload);
    expect(mocks.invoke).toHaveBeenCalledWith("plugin:android-share|take_pending_share");
  });

  it("subscribes to warm intents and rejects malformed native events", async () => {
    mocks.addPluginListener.mockResolvedValue({ unregister: vi.fn() });
    const handler = vi.fn();
    await listenForCharacterShares(handler);
    const nativeHandler = mocks.addPluginListener.mock.calls[0][2] as (payload: unknown) => void;
    nativeHandler({ status: "character" });
    expect(handler).toHaveBeenCalledWith({ status: "error", error: "unreadable" });
  });

  it("is a no-op outside Android", async () => {
    mocks.android.value = false;
    await expect(takePendingCharacterShare()).resolves.toEqual({ status: "empty" });
    await expect(listenForCharacterShares(vi.fn())).resolves.toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.addPluginListener).not.toHaveBeenCalled();
  });
});
