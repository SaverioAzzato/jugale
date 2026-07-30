/** Small interactive primitives for live play-state editing. */

import { useT } from "../i18n/useI18n";
import { usePressRepeat } from "./usePressRepeat";

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
  const dec = usePressRepeat(() => {
    if (value <= min) return false;
    onChange(value - 1);
  });
  const inc = usePressRepeat(() => {
    if (max != null && value >= max) return false;
    onChange(value + 1);
  });

  return (
    <span className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper-btn"
        disabled={value <= min}
        aria-label={t("stepper.decrease")}
        {...dec}
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
        {...inc}
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
