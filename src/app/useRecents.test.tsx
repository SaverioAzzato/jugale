import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listRecents: vi.fn(),
  removeRecent: vi.fn(async () => {}),
}));

vi.mock("../storage/recents", () => ({
  clearRecents: vi.fn(async () => {}),
  listRecents: mocks.listRecents,
  recentsSupported: () => true,
  recordRecent: vi.fn(async () => {}),
  removeRecent: mocks.removeRecent,
  reopenRecent: vi.fn(),
}));

import type { RecentEntry } from "../storage/recents";
import { useRecents } from "./useRecents";

describe("useRecents", () => {
  it("loads recents on the welcome screen and removes an entry locally", async () => {
    const entry: RecentEntry = {
      platform: "snapshot",
      kind: "file",
      name: "hero.json",
      key: "snapshot:file:hero.json",
      lastOpenedAt: 1,
      raw: { meta: { name: "Hero" } },
      images: [],
    };
    mocks.listRecents.mockResolvedValue([entry]);
    const { result } = renderHook(() => useRecents(false));
    await waitFor(() => expect(result.current.recents).toEqual([entry]));

    await act(() => result.current.removeRecent(entry.key));

    expect(mocks.removeRecent).toHaveBeenCalledWith(entry.key);
    expect(result.current.recents).toEqual([]);
  });
});
