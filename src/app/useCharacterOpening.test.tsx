import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { openCharacterFile, recordRecent } = vi.hoisted(() => ({
  openCharacterFile: vi.fn(),
  recordRecent: vi.fn(async () => {}),
}));

vi.mock("../storage/provider", async (importOriginal) => ({
  ...await importOriginal<typeof import("../storage/provider")>(),
  isFileAccessSupported: () => true,
  openCharacterFile,
}));
vi.mock("../storage/tauriProvider", () => ({
  isTauri: () => false,
  openCharacterFileTauri: vi.fn(),
  openCharacterFolderTauri: vi.fn(),
}));
vi.mock("../storage/androidProvider", () => ({
  isAndroid: () => false,
  openCharacterFileAndroid: vi.fn(),
  openCharacterFolderAndroid: vi.fn(),
}));
vi.mock("../storage/recents", () => ({ recordRecent }));

import { useCharacter } from "../characterStore";
import type { StorageProvider } from "../storage/provider";
import { useCharacterOpening } from "./useCharacterOpening";

describe("useCharacterOpening", () => {
  it("connects a picked writable JSON and records it as recent", async () => {
    const provider: StorageProvider = {
      kind: "file",
      read: vi.fn(async () => ({})),
      write: vi.fn(async () => {}),
    };
    const ref = { platform: "web" as const, kind: "file" as const, name: "hero.json", handle: {} };
    openCharacterFile.mockResolvedValue({ provider, raw: { meta: { name: "Hero" } }, ref });
    const { result } = renderHook(() => useCharacterOpening());

    act(() => result.current.handleOpenJson());

    await waitFor(() => expect(useCharacter.getState().provider).toBe(provider));
    expect(useCharacter.getState().character?.meta.name).toBe("Hero");
    expect(recordRecent).toHaveBeenCalledWith(ref);
  });
});
