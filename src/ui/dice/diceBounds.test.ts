import { describe, expect, it } from "vitest";
import { resolveCircleBounds } from "./diceBounds";

const viewport = { left: 0, top: 0, right: 390, bottom: 844 };

describe("dice UI bounds", () => {
  it("keeps a die below the complete app bar, including tabs", () => {
    expect(resolveCircleBounds({ x: 200, y: 40 }, 52, viewport, [
      { left: 0, top: 0, right: 390, bottom: 96 },
    ])).toEqual({ x: 200, y: 148 });
  });

  it("moves a die away from a floating dice button without leaving the viewport", () => {
    expect(resolveCircleBounds({ x: 350, y: 784 }, 52, viewport, [
      { left: 326, top: 760, right: 374, bottom: 808 },
    ])).toEqual({ x: 274, y: 784 });
  });

  it("keeps a die above the live-sync status bar", () => {
    expect(resolveCircleBounds({ x: 200, y: 810 }, 52, viewport, [
      { left: 0, top: 816, right: 390, bottom: 844 },
    ])).toEqual({ x: 200, y: 764 });
  });

  it("clamps dice fully inside a scaled or browser-zoomed visual viewport", () => {
    expect(resolveCircleBounds({ x: -20, y: 900 }, 52, viewport, [])).toEqual({ x: 52, y: 792 });
  });
});
