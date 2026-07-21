import { beforeEach, describe, expect, it } from "vitest";
import { useSettings } from "./useSettings";

describe("UI settings", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState({ toastSeconds: 10, units: "imperial", uiScale: 100 });
    document.documentElement.style.removeProperty("--ui-scale");
  });

  it("applies and persists the selected scale without losing other preferences", () => {
    useSettings.getState().setUnits("metric");
    useSettings.getState().setToastSeconds(15);
    useSettings.getState().setUiScale(120);

    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe("1.2");
    expect(JSON.parse(localStorage.getItem("dndm.settings") || "{}")).toEqual({
      toastSeconds: 15,
      units: "metric",
      uiScale: 120,
    });
  });
});
