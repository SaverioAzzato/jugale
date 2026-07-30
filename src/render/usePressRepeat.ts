import { useCallback, useEffect, useRef } from "react";

// Hold-to-repeat with acceleration ("typematic"): after the long-press delay, intervals shrink
// geometrically while held. The step stays 1 — repetition speeds up instead of becoming coarser.
const HOLD_DELAY_MS = 400;
const HOLD_START_MS = 180;
const HOLD_MIN_MS = 30;
const HOLD_RAMP = 0.8;
const PRESS_CANCEL_PX = 10;

/** Distinguishes an intentional tap/hold from a finger that is starting to scroll. A tap commits
 *  on release; a stationary hold commits after HOLD_DELAY_MS and then accelerates. Moving beyond
 *  PRESS_CANCEL_PX cancels before any value changes, leaving the browser free to pan the sheet. */
export function usePressRepeat(cb: () => void | boolean) {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressRef = useRef<{ pointerId: number; x: number; y: number; repeating: boolean } | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pressRef.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.isPrimary === false || (e.button ?? 0) !== 0 || pressRef.current) return;
    pressRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, repeating: false };
    let interval = HOLD_START_MS;
    const tick = () => {
      if (cbRef.current() === false) {
        cancel();
        return;
      }
      if (pressRef.current) pressRef.current.repeating = true;
      timerRef.current = setTimeout(tick, interval);
      interval = Math.max(HOLD_MIN_MS, interval * HOLD_RAMP);
    };
    timerRef.current = setTimeout(tick, HOLD_DELAY_MS);
  }, [cancel]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== e.pointerId || press.repeating) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) >= PRESS_CANCEL_PX) cancel();
  }, [cancel]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    const shouldTap = !press.repeating;
    cancel();
    if (shouldTap) cbRef.current();
  }, [cancel]);

  const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) cbRef.current(); // Enter/Space: there is no preceding pointer sequence
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClick,
  };
}
