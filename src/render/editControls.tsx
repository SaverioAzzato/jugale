/** Reusable inline-edit primitives for Edit mode. Controlled inputs themed to match
 *  the sheet; sections wire them to the store's editField/addItem/removeItem. */

import { useState, type ReactNode } from "react";
import { useT } from "../i18n/useI18n";

/** A labelled wrapper: a small caption above/beside an editor control. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="edit-field">
      <span className="edit-field-label">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  label,
  placeholder,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const common = {
    className: multiline ? "edit-input edit-textarea" : "edit-input",
    value,
    "aria-label": label,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  return multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />;
}

export function NumberInput({
  value,
  onChange,
  label,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      className="edit-input edit-number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      aria-label={label}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
    />
  );
}

/** A number that can be turned off entirely (→ null) — for the schema's `*Override`
 *  escape hatches and optional fields (AC/initiative override, resource spell level…). */
export function OptionalNumber({
  value,
  onChange,
  label,
  min,
  max,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  min?: number;
  max?: number;
}) {
  const enabled = value != null;
  return (
    <span className="edit-optnum">
      <label className="edit-optnum-toggle">
        <input
          type="checkbox"
          checked={enabled}
          aria-label={label}
          onChange={(e) => onChange(e.target.checked ? (min ?? 0) : null)}
        />
        <span>{label}</span>
      </label>
      {enabled && <NumberInput value={value ?? 0} onChange={onChange} label={label} min={min} max={max} />}
    </span>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label?: string;
}) {
  return (
    <select
      className="edit-input edit-select"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="edit-toggle">
      <input type="checkbox" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** An "×" button for removing a list entry. `label` is the accessible name. */
export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="edit-remove" onClick={onClick} aria-label={label} title={label}>
      ×
    </button>
  );
}

/** A list editor shell: the rows (children) plus a footer "＋ Add" button. */
export function EntryList({
  children,
  onAdd,
  addLabel,
}: {
  children: ReactNode;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="edit-list">
      {children}
      <button type="button" className="btn edit-add" onClick={onAdd}>
        ＋ {addLabel}
      </button>
    </div>
  );
}

/** A bordered row inside an EntryList: its editor fields plus a remove button.
 *  The remove control is a small "×" badge overlaying the card's top-left
 *  corner — absolutely positioned, so it reserves no layout space at all. */
export function EntryRow({
  children,
  onRemove,
  removeLabel,
}: {
  children: ReactNode;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="edit-entry">
      <button type="button" className="edit-entry-close" onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
        ×
      </button>
      <div className="edit-entry-fields">{children}</div>
    </div>
  );
}

/** Localized "Add"/"Remove" helpers so call sites stay terse. */
export function useEditLabels() {
  const t = useT();
  return { add: t("edit.add"), remove: t("edit.remove") };
}

/** Editor for a `string[]` shown as chips: each removable, plus an add input.
 *  Best for short flat values (languages, tools, proficiencies). */
export function TagListEditor({
  values,
  onChange,
  label,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  label: string;
  placeholder?: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="edit-taglist">
      <div className="edit-tags">
        {values.map((v, i) => (
          <span key={i} className="edit-tag">
            {v}
            <button
              type="button"
              className="edit-tag-remove"
              aria-label={`${t("edit.remove")}: ${v}`}
              onClick={() => onChange(values.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="edit-tag-add">
        <input
          type="text"
          className="edit-input"
          value={draft}
          aria-label={label}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <button type="button" className="btn edit-add edit-add-icon" onClick={commit} aria-label={t("edit.add")} title={t("edit.add")}>
          ＋
        </button>
      </div>
    </div>
  );
}

/** Editor for a `string[]` as one text input per line (add/remove rows).
 *  Best for longer prose entries (narrative bullets, notes). */
export function StringListEditor({
  values,
  onChange,
  label,
  addLabel,
  multiline,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  label: string;
  addLabel: string;
  multiline?: boolean;
}) {
  return (
    <EntryList onAdd={() => onChange([...values, ""])} addLabel={addLabel}>
      {values.map((v, i) => (
        <div className="edit-strrow" key={i}>
          <TextInput
            value={v}
            multiline={multiline}
            label={`${label} ${i + 1}`}
            onChange={(next) => onChange(values.map((x, j) => (j === i ? next : x)))}
          />
          <RemoveButton onClick={() => onChange(values.filter((_, j) => j !== i))} label={label} />
        </div>
      ))}
    </EntryList>
  );
}
