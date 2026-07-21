import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type React from "react";
import { useHorizontalSwipe } from "./useSwipeNav";

type Pt = { clientX: number; clientY: number };
const touch = (touches: Pt[], changed: Pt[], target: EventTarget = document.createElement("div")) =>
  ({ touches, changedTouches: changed, target }) as unknown as React.TouchEvent;

function swipe(from: Pt, to: Pt, target?: EventTarget) {
  const onSwipe = vi.fn();
  const { result } = renderHook(() => useHorizontalSwipe(onSwipe));
  result.current.onTouchStart(touch([from], [from], target));
  result.current.onTouchEnd(touch([], [to], target));
  return onSwipe;
}

describe("useHorizontalSwipe", () => {
  it("advances on a left swipe and goes back on a right swipe", () => {
    expect(swipe({ clientX: 200, clientY: 100 }, { clientX: 80, clientY: 110 })).toHaveBeenCalledWith(1);
    expect(swipe({ clientX: 80, clientY: 100 }, { clientX: 220, clientY: 90 })).toHaveBeenCalledWith(-1);
  });

  it("ignores mostly-vertical drags (scrolling)", () => {
    expect(swipe({ clientX: 100, clientY: 100 }, { clientX: 130, clientY: 300 })).not.toHaveBeenCalled();
  });

  it("ignores short horizontal movement (a tap wobble)", () => {
    expect(swipe({ clientX: 100, clientY: 100 }, { clientX: 130, clientY: 100 })).not.toHaveBeenCalled();
  });

  it("gives text fields priority — a swipe that starts on an input is ignored", () => {
    const input = document.createElement("input");
    expect(swipe({ clientX: 200, clientY: 100 }, { clientX: 60, clientY: 100 }, input)).not.toHaveBeenCalled();
  });

  it("gives gesture-owning regions priority over tab navigation", () => {
    const gallery = document.createElement("div");
    gallery.className = "no-swipe";
    const image = document.createElement("img");
    gallery.appendChild(image);
    expect(swipe({ clientX: 200, clientY: 100 }, { clientX: 60, clientY: 100 }, image)).not.toHaveBeenCalled();
  });

  it("ignores multi-touch gestures (pinch/zoom)", () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useHorizontalSwipe(onSwipe));
    const a = { clientX: 200, clientY: 100 };
    const b = { clientX: 100, clientY: 100 };
    result.current.onTouchStart(touch([a, b], [a, b])); // two fingers → not a swipe
    result.current.onTouchEnd(touch([], [{ clientX: 60, clientY: 100 }]));
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
