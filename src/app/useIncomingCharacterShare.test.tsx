import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IncomingSharePayload } from "../share/incomingCharacterShare";

const mocks = vi.hoisted(() => ({
  handler: null as ((payload: IncomingSharePayload) => void) | null,
}));

vi.mock("../storage/androidProvider", () => ({
  IMPORT_TARGET_NOT_EMPTY: "import-target-not-empty",
  isAndroid: () => true,
  pickCharacterImportTargetAndroid: vi.fn(async () => null),
}));
vi.mock("../storage/recents", () => ({ recordRecent: vi.fn(async () => {}) }));
vi.mock("../share/incomingCharacterShare", () => ({
  listenForCharacterShares: vi.fn(async (handler: (payload: IncomingSharePayload) => void) => {
    mocks.handler = handler;
    return { unregister: vi.fn(async () => {}) };
  }),
  takePendingCharacterShare: vi.fn(async () => ({ status: "empty" })),
}));

import { useIncomingCharacterShare } from "./useIncomingCharacterShare";

describe("useIncomingCharacterShare", () => {
  it("previews a valid warm share without applying it", async () => {
    const { result } = renderHook(() => useIncomingCharacterShare(null, vi.fn()));
    await waitFor(() => expect(mocks.handler).not.toBeNull());

    act(() => mocks.handler?.({
      status: "character",
      id: "share-1",
      name: "incoming.json",
      mime: "application/json",
      contents: JSON.stringify({ meta: { name: "Incoming" }, extension: { kept: true } }),
    }));

    expect(result.current.incoming?.preview.character.meta.name).toBe("Incoming");
    expect(result.current.incoming?.raw).toEqual({ meta: { name: "Incoming" }, extension: { kept: true } });
  });
});
