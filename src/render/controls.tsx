/** Small interactive primitives for live play-state editing. */

export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper-btn" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="meno">
        −
      </button>
      <span className="stepper-value">{value}</span>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(value + 1)}
        disabled={max != null && value >= max}
        aria-label="più"
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
