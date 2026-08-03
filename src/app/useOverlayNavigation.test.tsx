import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../storage/androidProvider", () => ({ isAndroid: () => false }));

import { useOverlayNavigation } from "./useOverlayNavigation";

function options(overrides = {}) {
  return {
    characterOpen: true,
    dirty: false,
    liveSync: false,
    versionBusy: false,
    clearCharacter: vi.fn(),
    confirmLeave: vi.fn(() => true),
    ...overrides,
  };
}

describe("useOverlayNavigation", () => {
  it("opens and closes an overlay through Escape", () => {
    const { result } = renderHook(() => useOverlayNavigation(options()));
    act(() => result.current.setOverlay("help"));
    expect(result.current.overlay).toBe("help");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(result.current.overlay).toBeNull();
  });

  it("keeps an unsaved character open when confirmation is declined", () => {
    const clearCharacter = vi.fn();
    const confirmLeave = vi.fn(() => false);
    const { result } = renderHook(() => useOverlayNavigation(options({ dirty: true, clearCharacter, confirmLeave })));
    expect(result.current.handleUiBack()).toBe(false);
    expect(confirmLeave).toHaveBeenCalledTimes(1);
    expect(clearCharacter).not.toHaveBeenCalled();
  });
});
