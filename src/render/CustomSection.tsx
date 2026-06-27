import { useState } from "react";
import type { Character } from "../schema";
import { Panel, DataTable } from "./primitives";
import { Field, TextInput, Select, EntryList, EntryRow, TagListEditor, StringListEditor } from "./editControls";
import { newCustomSection } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT, type StringKey } from "../i18n/useI18n";

type Custom = Character["customSections"][number];
type CustomLayout = Custom["layout"];

const LAYOUTS: CustomLayout[] = ["text", "list", "checklist", "keyValue", "cards", "table"];

export function CustomSections({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  if (editMode) return <CustomEdit c={c} />;
  if (c.customSections.length === 0) return null;
  return (
    <>
      {c.customSections.map((s) => (
        <Panel key={s.id || s.title} title={s.title || t("custom.fallback")} id={`custom-${s.id}`}>
          <Layout section={s} />
        </Panel>
      ))}
    </>
  );
}

/** A JSON textarea for a section's freeform `items[]` — commits only when it parses.
 *  Used for the `table` layout (and any shape the structured editors don't cover). */
function JsonItems({ value, onChange }: { value: unknown[]; onChange: (next: unknown[]) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2));
  const [valid, setValid] = useState(true);
  return (
    <Field label={t("custom.itemsJson")}>
      <textarea
        className="edit-input edit-textarea"
        rows={5}
        value={draft}
        aria-label={t("custom.itemsJson")}
        aria-invalid={!valid}
        onChange={(e) => {
          setDraft(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            setValid(Array.isArray(parsed));
            if (Array.isArray(parsed)) onChange(parsed);
          } catch {
            setValid(false);
          }
        }}
      />
      <span className="edit-hint">{t("custom.itemsHint")}</span>
    </Field>
  );
}

/** The body editor for a custom section, chosen by its layout. */
function LayoutEditor({ section, index }: { section: Custom; index: number }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);
  const items = section.items as Record<string, unknown>[];
  const itemsPath = ["customSections", index, "items"] as const;
  const setItems = (next: unknown[]) => editField([...itemsPath], next);

  switch (section.layout) {
    case "text":
      return (
        <Field label={t("edit.description")}>
          <TextInput
            value={section.content}
            multiline
            onChange={(v) => editField(["customSections", index, "content"], v)}
            label={t("edit.description")}
          />
        </Field>
      );

    case "list":
      return (
        <StringListEditor
          values={items.map((x) => (typeof x === "string" ? x : String(x?.label ?? "")))}
          onChange={setItems}
          label={t("custom.title")}
          addLabel={t("edit.add")}
        />
      );

    case "checklist":
      return (
        <EntryList onAdd={() => addItem([...itemsPath], { label: "", done: false })} addLabel={t("edit.add")}>
          {items.map((it, j) => (
            <EntryRow key={j} onRemove={() => removeItem([...itemsPath], j)} removeLabel={t("edit.remove")}>
              <label className="edit-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(it.done)}
                  onChange={(e) => editField([...itemsPath, j, "done"], e.target.checked)}
                />
              </label>
              <TextInput
                value={String(it.label ?? "")}
                onChange={(v) => editField([...itemsPath, j, "label"], v)}
                label={t("custom.title")}
              />
            </EntryRow>
          ))}
        </EntryList>
      );

    case "keyValue":
      return (
        <EntryList onAdd={() => addItem([...itemsPath], { key: "", value: "" })} addLabel={t("edit.add")}>
          {items.map((it, j) => (
            <EntryRow key={j} onRemove={() => removeItem([...itemsPath], j)} removeLabel={t("edit.remove")}>
              <TextInput value={String(it.key ?? "")} onChange={(v) => editField([...itemsPath, j, "key"], v)} label="key" />
              <TextInput value={String(it.value ?? "")} onChange={(v) => editField([...itemsPath, j, "value"], v)} label="value" />
            </EntryRow>
          ))}
        </EntryList>
      );

    case "cards":
      return (
        <EntryList onAdd={() => addItem([...itemsPath], { title: "", text: "" })} addLabel={t("edit.add")}>
          {items.map((it, j) => (
            <EntryRow key={j} onRemove={() => removeItem([...itemsPath], j)} removeLabel={t("edit.remove")}>
              <TextInput value={String(it.title ?? "")} onChange={(v) => editField([...itemsPath, j, "title"], v)} label={t("custom.title")} />
              <TextInput value={String(it.text ?? "")} multiline onChange={(v) => editField([...itemsPath, j, "text"], v)} label={t("edit.description")} />
            </EntryRow>
          ))}
        </EntryList>
      );

    case "table":
      return (
        <>
          <Field label={t("custom.columns")}>
            <TagListEditor
              values={section.columns}
              onChange={(next) => editField(["customSections", index, "columns"], next)}
              label={t("custom.columns")}
            />
          </Field>
          <JsonItems value={section.items} onChange={setItems} />
        </>
      );

    default:
      return null;
  }
}

/** CRUD for the whole custom-sections list. */
function CustomEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);
  const layoutOptions = LAYOUTS.map((v) => ({ value: v, label: t(`layout.${v}` as StringKey) }));

  return (
    <Panel title={t("custom.fallback")} id="custom">
      <EntryList onAdd={() => addItem(["customSections"], newCustomSection())} addLabel={t("custom.addSection")}>
        {c.customSections.map((s, i) => (
          <div key={s.id || i} className="edit-section">
            <button
              type="button"
              className="edit-entry-close"
              onClick={() => removeItem(["customSections"], i)}
              aria-label={t("edit.remove")}
              title={t("edit.remove")}
            >
              ×
            </button>
            <div className="edit-section-head">
              <Field label={t("custom.title")}>
                <TextInput value={s.title} onChange={(v) => editField(["customSections", i, "title"], v)} label={t("custom.title")} />
              </Field>
              <Field label={t("custom.layout")}>
                <Select
                  value={s.layout}
                  onChange={(v) => editField(["customSections", i, "layout"], v)}
                  options={layoutOptions}
                  label={t("custom.layout")}
                />
              </Field>
            </div>
            <LayoutEditor section={s} index={i} />
          </div>
        ))}
      </EntryList>
    </Panel>
  );
}

/** Renders a user-defined section by its `layout` hint — zero code per new section. */
function Layout({ section }: { section: Custom }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = section.items as any[];

  switch (section.layout) {
    case "text":
      return <p>{section.content}</p>;

    case "list":
      return (
        <ul className="bullets">
          {items.map((it, i) => (
            <li key={i}>{typeof it === "string" ? it : (it?.label ?? JSON.stringify(it))}</li>
          ))}
        </ul>
      );

    case "checklist":
      return (
        <ul className="checklist">
          {items.map((it, i) => (
            <li key={i}>
              {it?.done ? "☑" : "☐"} {it?.label ?? String(it)}
            </li>
          ))}
        </ul>
      );

    case "keyValue":
      return (
        <dl className="kv">
          {items.map((it, i) => {
            const key = it?.key ?? Object.keys(it ?? {})[0];
            const value = it?.value ?? Object.values(it ?? {})[0];
            return (
              <div key={i} className="kv-row">
                <dt>{String(key ?? "")}</dt>
                <dd>{String(value ?? "")}</dd>
              </div>
            );
          })}
        </dl>
      );

    case "cards":
      return (
        <div className="cards">
          {items.map((it, i) => (
            <div key={i} className="mini-card">
              <strong>{it?.title ?? it?.name}</strong>
              <p>{it?.text ?? it?.description}</p>
            </div>
          ))}
        </div>
      );

    case "table": {
      const columns = section.columns.length > 0 ? section.columns : Object.keys(items[0] ?? {});
      return (
        <DataTable
          headers={columns}
          rows={items.map((it) => columns.map((col) => it?.[col]))}
        />
      );
    }

    default:
      return null;
  }
}
