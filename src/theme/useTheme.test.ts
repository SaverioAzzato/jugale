import { describe, it, expect } from "vitest";
import { useTheme, THEMES } from "./useTheme";

describe("useTheme", () => {
  it("exposes the available themes", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["arcane", "night", "parchment"]);
  });

  it("applies the theme to <html> and persists it", () => {
    useTheme.getState().setTheme("parchment");
    expect(document.documentElement.dataset.theme).toBe("parchment");
    expect(localStorage.getItem("dndm.theme")).toBe("parchment");
    expect(useTheme.getState().theme).toBe("parchment");

    useTheme.getState().setTheme("night");
    expect(document.documentElement.dataset.theme).toBe("night");
  });
});
