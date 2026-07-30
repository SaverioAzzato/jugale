import { useRef } from "react";

/**
 * Horizontal-swipe detection for touch, used to page between tabs on mobile. Touch-only and
 * non-preventing: it reads the gesture on touchend, so vertical scrolling, taps, and desktop
 * mouse use are all unaffected. A swipe is ignored when it begins on a control or a region that
 * owns horizontal dragging itself (inputs, the JSON editor, anything marked `.no-swipe`), so a
 * text field keeps priority over the tab gesture.
 */
const SWIPE_MIN_PX = 60; // horizontal distance that counts as a swipe
const SWIPE_H_RATIO = 1.5; // must be this much more horizontal than vertical
const DRAG_MIN_PX = 10; // movement beyond a tap wobble suppresses control activation

function startsOnInteractive(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable], .cm-editor, .no-swipe") !== null
  );
}

/** Returns touch handlers that call `onSwipe(-1)` on a right-swipe (→) and `onSwipe(1)` on a
 *  left-swipe (←) — i.e. left-swipe advances, matching how carousels page forward. */
export function useHorizontalSwipe(onSwipe: (dir: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number; dragged: boolean } | null>(null);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1 || startsOnInteractive(e.target)) {
        start.current = null;
        return;
      }
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, dragged: false };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = start.current;
      if (!s || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - s.x, t.clientY - s.y) >= DRAG_MIN_PX) s.dragged = true;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      // A swipe/scroll that began on an ordinary button or link must not synthesize a trailing
      // click. Preventing touchend's compatibility click does not block the native pan already in
      // progress, and press-repeat controls independently cancel on pointer movement.
      if (s.dragged) e.preventDefault();
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_H_RATIO) return;
      onSwipe(dx < 0 ? 1 : -1);
    },
    onTouchCancel: () => {
      start.current = null;
    },
  };
}
