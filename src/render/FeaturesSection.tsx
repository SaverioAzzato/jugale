import type { Character } from "../schema";
import { Panel, WikiLink } from "./primitives";
import { Field, TextInput, Select, OptionalNumber, NumberInput, Toggle, EntryList, EntryRow } from "./editControls";
import { newFeature } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT, type StringKey } from "../i18n/useI18n";

const SOURCES = ["class", "subclass", "race", "background", "feat", "item", "custom"] as const;

function FeaturesEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);
  const sourceOptions = SOURCES.map((v) => ({ value: v, label: t(`source.${v}` as StringKey) }));

  return (
    <Panel title={t("features.title")} id="features">
      <EntryList onAdd={() => addItem(["features"], newFeature())} addLabel={t("features.addFeature")}>
        {c.features.map((f, i) => {
          const base = ["features", i] as const;
          return (
            <EntryRow key={f.id || i} onRemove={() => removeItem(["features"], i)} removeLabel={t("edit.remove")}>
              <Field label={t("item.name")}>
                <TextInput value={f.name} onChange={(v) => editField([...base, "name"], v)} label={t("item.name")} />
              </Field>
              <Field label={t("feature.source")}>
                <Select
                  value={f.source}
                  onChange={(v) => editField([...base, "source"], v)}
                  options={sourceOptions}
                  label={t("feature.source")}
                />
              </Field>
              <OptionalNumber value={f.level} label={t("header.level")} onChange={(v) => editField([...base, "level"], v)} />
              <Field label={t("resource.link")}>
                <TextInput
                  value={f.link ?? ""}
                  onChange={(v) => editField([...base, "link"], v === "" ? null : v)}
                  label={t("resource.link")}
                />
              </Field>
              <Field label={t("edit.description")}>
                <TextInput value={f.description} multiline onChange={(v) => editField([...base, "description"], v)} label={t("edit.description")} />
              </Field>
              <details className="edit-sub">
                <summary>{t("feature.usesResource")}</summary>
                <Toggle
                  checked={f.uses != null}
                  label={t("feature.usesResource")}
                  onChange={(v) => editField([...base, "uses"], v ? { resourceId: "", amount: 1 } : null)}
                />
                {f.uses && (
                  <div className="edit-grid">
                    <Field label={t("feature.usesResource")}>
                      <TextInput
                        value={f.uses.resourceId}
                        onChange={(v) => editField([...base, "uses", "resourceId"], v)}
                        label={t("feature.usesResource")}
                      />
                    </Field>
                    <Field label={t("feature.usesAmount")}>
                      <NumberInput
                        value={f.uses.amount}
                        min={1}
                        onChange={(v) => editField([...base, "uses", "amount"], v)}
                        label={t("feature.usesAmount")}
                      />
                    </Field>
                  </div>
                )}
              </details>
            </EntryRow>
          );
        })}
      </EntryList>
    </Panel>
  );
}

export function FeaturesSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  if (editMode) return <FeaturesEdit c={c} />;
  if (c.features.length === 0) return null;
  return (
    <Panel title={t("features.title")} id="features">
      <ul className="feature-list">
        {c.features.map((f) => (
          <li key={f.id || f.name}>
            <WikiLink link={f.link}>
              <strong>{f.name}</strong>
            </WikiLink>
            <span className="muted">
              {" "}
              ({t(`source.${f.source}` as StringKey)}
              {f.level ? `, ${t("features.level")} ${f.level}` : ""})
            </span>
            {f.description ? <p className="feature-desc">{f.description}</p> : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
