/** Small interactive primitives for live play-state editing. */

import { useRef, useCallback } from "react";

/** Fires `cb` immediately, then repeatedly after a delay + interval while held.
 *  Uses a ref so the interval always sees the latest `cb` (avoids stale closures). */
export function useHoldRepeat(cb: () => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    cbRef.current();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => cbRef.current(), 80);
    }, 400);
  }, []);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

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
  const dec = useHoldRepeat(() => onChange(value - 1));
  const inc = useHoldRepeat(() => onChange(value + 1));

  return (
    <span className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper-btn"
        disabled={value <= min}
        aria-label="meno"
        onMouseDown={dec.start}
        onMouseUp={dec.stop}
        onMouseLeave={dec.stop}
        onTouchStart={(e) => {
          e.preventDefault();
          dec.start();
        }}
        onTouchEnd={dec.stop}
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
        aria-label="più"
        onMouseDown={inc.start}
        onMouseUp={inc.stop}
        onMouseLeave={inc.stop}
        onTouchStart={(e) => {
          e.preventDefault();
          inc.start();
        }}
        onTouchEnd={inc.stop}
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
