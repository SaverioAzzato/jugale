import type { Character } from "../schema";
import { Panel } from "./primitives";
import { Field, TextInput, Select, StringListEditor, EntryList, EntryRow } from "./editControls";
import { newAction } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT } from "../i18n/useI18n";

/**
 * Rests + custom actions, grouped together. Short/Long rest apply the built-in
 * reset and then any registered actions of that kind; custom actions get their own
 * buttons. The formulae themselves are hidden for now — they'll be surfaced (and
 * editable) once Edit mode lands.
 */
/** CRUD for registered actions (rest perks + custom one-tap effects). */
function ActionsEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);
  const kindOptions = [
    { value: "shortRest", label: t("vitals.shortRest") },
    { value: "longRest", label: t("vitals.longRest") },
    { value: "custom", label: t("actionkind.custom") },
  ];

  return (
    <Panel title={t("actions.title")} id="actions">
      <EntryList onAdd={() => addItem(["actions"], newAction())} addLabel={t("actions.addAction")}>
        {c.actions.map((a, i) => {
          const base = ["actions", i] as const;
          return (
            <EntryRow key={a.id || i} onRemove={() => removeItem(["actions"], i)} removeLabel={t("edit.remove")}>
              <Field label={t("action.label")}>
                <TextInput value={a.label} onChange={(v) => editField([...base, "label"], v)} label={t("action.label")} />
              </Field>
              <Field label={t("action.kind")}>
                <Select value={a.kind} onChange={(v) => editField([...base, "kind"], v)} options={kindOptions} label={t("action.kind")} />
              </Field>
              <Field label={t("action.info")}>
                <TextInput value={a.info} onChange={(v) => editField([...base, "info"], v)} label={t("action.info")} />
              </Field>
              <Field label={t("actions.formulas")}>
                <StringListEditor
                  values={a.formulas}
                  onChange={(next) => editField([...base, "formulas"], next)}
                  label={t("actions.formulas")}
                  addLabel={t("edit.add")}
                />
              </Field>
              <p className="edit-hint">{t("action.formulaHint")}</p>
            </EntryRow>
          );
        })}
      </EntryList>
    </Panel>
  );
}

export function ActionsSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  const shortRest = useCharacter((s) => s.shortRest);
  const longRest = useCharacter((s) => s.longRest);
  const runAction = useCharacter((s) => s.runAction);
  if (editMode) return <ActionsEdit c={c} />;

  const customActions = c.actions.filter((a) => a.kind === "custom");

  return (
    <Panel title={t("actions.title")} id="actions">
      <div className="action-list">
        <div className="action-row">
          <button type="button" className="btn action-btn" onClick={shortRest}>
            {t("vitals.shortRest")}
          </button>
          <p className="action-desc">{t("actions.shortRestInfo")}</p>
        </div>
        <div className="action-row">
          <button type="button" className="btn action-btn" onClick={longRest}>
            {t("vitals.longRest")}
          </button>
          <p className="action-desc">{t("actions.longRestInfo")}</p>
        </div>
        {customActions.map((a) => (
          <div className="action-row" key={a.id}>
            <button type="button" className="btn action-btn" onClick={() => runAction(a.id)}>
              {a.label || a.id}
            </button>
            {a.info && <p className="action-desc">{a.info}</p>}
          </div>
        ))}
      </div>
    </Panel>
  );
}
