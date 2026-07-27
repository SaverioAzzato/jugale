import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettings } from "./useSettings";

describe("UI settings", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState({ toastSeconds: 10, units: "imperial", uiScale: 100, versionHistory: false });
    document.documentElement.style.removeProperty("--ui-scale");
  });

  it("applies and persists the selected scale without losing other preferences", () => {
    useSettings.getState().setUnits("metric");
    useSettings.getState().setToastSeconds(15);
    useSettings.getState().setUiScale(120);
    useSettings.getState().setVersionHistory(true);

    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1.2");
    expect(JSON.parse(localStorage.getItem("dndm.settings") || "{}")).toEqual({
      toastSeconds: 15,
      units: "metric",
      uiScale: 120,
      versionHistory: true,
    });
  });

  it("enables character versions by default for a new installation", async () => {
    localStorage.clear();
    vi.resetModules();
    const { useSettings: freshSettings } = await import("./useSettings");
    expect(freshSettings.getState().versionHistory).toBe(true);
  });
});
