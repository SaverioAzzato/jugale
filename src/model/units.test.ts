import { describe, expect, it } from "vitest";
import { convertDistanceText, feetToMeters, formatDistance, formatWeight, poundsToKg } from "./units";

describe("feetToMeters", () => {
  it("converts using the 0.3 m/ft table", () => {
    expect(feetToMeters(5)).toBe(1.5);
    expect(feetToMeters(30)).toBe(9);
    expect(feetToMeters(0)).toBe(0);
  });
});

describe("formatDistance", () => {
  it("passes through feet when imperial", () => {
    expect(formatDistance(30, "imperial")).toBe("30 ft");
  });

  it("converts to meters when metric", () => {
    expect(formatDistance(30, "metric")).toBe("9 m");
    expect(formatDistance(5, "metric")).toBe("1.5 m");
  });
});

describe("convertDistanceText", () => {
  it("leaves text untouched in imperial mode", () => {
    expect(convertDistanceText("100/400 ft", "imperial")).toBe("100/400 ft");
  });

  it("rewrites every ft occurrence in metric mode", () => {
    expect(convertDistanceText("100/400 ft", "metric")).toBe("30/120 m");
  });

  it("rewrites a single distance with trailing words", () => {
    expect(convertDistanceText("15 ft cone", "metric")).toBe("4.5 m cone");
  });

  it("leaves non-distance text unchanged", () => {
    expect(convertDistanceText("Self", "metric")).toBe("Self");
    expect(convertDistanceText("", "metric")).toBe("");
  });
});

describe("poundsToKg", () => {
  it("converts using the 0.5 kg/lb table", () => {
    expect(poundsToKg(6)).toBe(3);
    expect(poundsToKg(255)).toBe(127.5);
    expect(poundsToKg(0)).toBe(0);
  });
});

describe("formatWeight", () => {
  it("passes through pounds when imperial", () => {
    expect(formatWeight(6, "imperial")).toBe("6 lb");
  });

  it("converts to kilograms when metric", () => {
    expect(formatWeight(6, "metric")).toBe("3 kg");
    expect(formatWeight(255, "metric")).toBe("127.5 kg");
  });
});
