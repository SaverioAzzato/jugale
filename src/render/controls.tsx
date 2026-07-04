/** Small interactive primitives for live play-state editing. */

import { useRef, useCallback } from "react";
import { useT } from "../i18n/useI18n";

/** Fires `cb` immediately, then repeatedly after a delay + interval while held.
 *  Uses a ref so the interval always sees the latest `cb` (avoids stale closures).
 *  If `cb` returns false (e.g. a bound was reached) the repeat self-stops. */
export function useHoldRepeat(cb: () => void | boolean) {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const start = useCallback(() => {
    if (cbRef.current() === false) return; // already at a bound: don't schedule a repeat
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        if (cbRef.current() === false) stop();
      }, 80);
    }, 400);
  }, [stop]);

  return { start, stop };
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  label,
  showMax = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
  /** Render the cap as `value/max` inside the control (only the current value is highlighted). */
  showMax?: boolean;
}) {
  const t = useT();
  // Return false at the bound so a held button stops instead of running past it.
  const dec = useHoldRepeat(() => {
    if (value <= min) return false;
    onChange(value - 1);
  });
  const inc = useHoldRepeat(() => {
    if (max != null && value >= max) return false;
    onChange(value + 1);
  });

  // Pointer events unify mouse/touch/pen into a single event stream, so a tap fires `start()`
  // exactly once. (The old mouse+touch handler pair double-fired on mobile — a touchstart plus
  // the browser's synthesized mousedown both stepped, so one tap moved by 2.) A pointer tap still
  // emits a trailing compatibility `click`, but that reports `detail >= 1`; keyboard activation
  // (Enter/Space) fires a `click` with `detail === 0` and no pointerdown. So onClick only runs the
  // keyboard path, where start()+stop() steps exactly once and cancels the pending hold-repeat.
  const onKeyboardClick = (repeat: ReturnType<typeof useHoldRepeat>) => (e: React.MouseEvent) => {
    if (e.detail !== 0) return;
    repeat.start();
    repeat.stop();
  };

  return (
    <span className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper-btn"
        disabled={value <= min}
        aria-label={t("stepper.decrease")}
        onPointerDown={dec.start}
        onPointerUp={dec.stop}
        onPointerLeave={dec.stop}
        onPointerCancel={dec.stop}
        onClick={onKeyboardClick(dec)}
      >
        −
      </button>
      <span className="stepper-value">
        {value}
        {showMax && max != null && <span className="stepper-max">/{max}</span>}
      </span>
      <button
        type="button"
        className="stepper-btn"
        disabled={max != null && value >= max}
        aria-label={t("stepper.increase")}
        onPointerDown={inc.start}
        onPointerUp={inc.stop}
        onPointerLeave={inc.stop}
        onPointerCancel={inc.stop}
        onClick={onKeyboardClick(inc)}
      >
        +
      </button>
    </span>
  );
}

export function NumberField({
  value,
  onCommit,
  label,
  min = 0,
}: {
  value: number;
  onCommit: (next: number) => void;
  label: string;
  min?: number;
}) {
  return (
    <label className="numfield">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onCommit(Number(e.target.value))}
      />
    </label>
  );
}
