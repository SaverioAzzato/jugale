import { describe, expect, it } from "vitest";
import { fixedAnchorAbove, fixedAnchorBelow, pointToNdc } from "./zoomCoordinates";

describe("zoom-aware coordinates", () => {
  it("maps client coordinates relative to the rendered canvas rectangle", () => {
    const rect = { left: 10, top: 20, width: 400, height: 800 };

    expect(pointToNdc(210, 420, rect)).toEqual({ x: 0, y: 0 });
    expect(pointToNdc(10, 20, rect)).toEqual({ x: -1, y: 1 });
    expect(pointToNdc(410, 820, rect)).toEqual({ x: 1, y: -1 });
  });

  it("converts a visual anchor back into the CSS-root coordinate space", () => {
    expect(fixedAnchorBelow({ bottom: 60, right: 300 }, 412, 1.2)).toEqual({
      top: 58,
      right: 93.33333333333334,
    });
    expect(fixedAnchorAbove({ top: 700, right: 300 }, { width: 412, height: 844 }, 1.2)).toEqual({
      bottom: 128,
      right: 93.33333333333334,
    });
  });
});
