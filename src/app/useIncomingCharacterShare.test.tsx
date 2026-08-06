import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncomingSharePayload } from "../share/incomingCharacterShare";

const mocks = vi.hoisted(() => ({
  handler: null as ((payload: IncomingSharePayload) => void) | null,
  recordRecent: vi.fn(async () => {}),
  pickTarget: vi.fn(),
}));

vi.mock("../storage/androidProvider", () => ({
  IMPORT_TARGET_NOT_EMPTY: "import-target-not-empty",
  isAndroid: () => true,
}));
vi.mock("../storage/recents", () => ({ recordRecent: mocks.recordRecent }));
vi.mock("../storage/characterImport", () => ({ pickCharacterImportTarget: mocks.pickTarget }));
vi.mock("../share/incomingCharacterShare", () => ({
  listenForCharacterShares: vi.fn(async (handler: (payload: IncomingSharePayload) => void) => {
    mocks.handler = handler;
    return { unregister: vi.fn(async () => {}) };
  }),
  takePendingCharacterShare: vi.fn(async () => ({ status: "empty" })),
}));

import { useIncomingCharacterShare } from "./useIncomingCharacterShare";
import { useCharacter } from "../characterStore";
import { useToast } from "../ui/useToast";

describe("useIncomingCharacterShare", () => {
  beforeEach(() => {
    mocks.handler = null;
    mocks.recordRecent.mockClear();
    mocks.pickTarget.mockReset();
    mocks.pickTarget.mockResolvedValue(null);
  });

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

  it("stages a picked JSON through the same preview without applying it", () => {
    const { result } = renderHook(() => useIncomingCharacterShare(null, vi.fn()));
    act(() => result.current.stageFileImport({ meta: { name: "Picked" } }, "returned.json"));
    expect(result.current.incoming?.source).toBe("file-import");
    expect(result.current.incoming?.preview.character.meta.name).toBe("Picked");
    expect(useCharacter.getState().character).toBeNull();
  });

  it("creates and opens a picked character in a chosen empty folder", async () => {
    const provider = { kind: "file" as const, read: vi.fn(), write: vi.fn(), versions: {} };
    const create = vi.fn(async (document) => ({
      provider,
      raw: document.document,
      images: [],
      sourceName: "picked-folder",
    }));
    mocks.pickTarget.mockResolvedValue({
      kind: "empty",
      sourceName: "picked-folder",
      ref: { platform: "web", kind: "folder", name: "picked-folder", handle: {} },
      create,
    });
    const { result } = renderHook(() => useIncomingCharacterShare(null, vi.fn()));
    act(() => result.current.stageFileImport({ meta: { name: "Picked" }, extension: { kept: true } }, "returned.json"));

    await act(() => result.current.chooseTarget());
    expect(result.current.targetName).toBe("picked-folder");
    await act(() => result.current.apply());

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      document: expect.objectContaining({ extension: { kept: true } }),
    }));
    expect(useCharacter.getState().character?.meta.name).toBe("Picked");
    expect(useCharacter.getState().readOnly).toBe(false);
    expect(result.current.incoming).toBeNull();
  });

  it("keeps the preview open and reports a failed folder creation", async () => {
    mocks.pickTarget.mockResolvedValue({
      kind: "empty",
      sourceName: "picked-folder",
      ref: { platform: "web", kind: "folder", name: "picked-folder", handle: {} },
      create: vi.fn(async () => { throw new Error("disk full"); }),
    });
    const { result } = renderHook(() => useIncomingCharacterShare(null, vi.fn()));
    act(() => result.current.stageFileImport({ meta: { name: "Picked" } }, "returned.json"));

    await act(() => result.current.chooseTarget());
    await act(() => result.current.apply());

    expect(result.current.incoming?.preview.character.meta.name).toBe("Picked");
    expect(useToast.getState().toasts.at(-1)).toMatchObject({ kind: "error", detail: "disk full" });
  });
});
