import type { Character } from "../schema";
import { Panel, WikiLink } from "./primitives";
import { Stepper } from "./controls";
import { Field, TextInput, NumberInput, Select, OptionalNumber, EntryList, EntryRow } from "./editControls";
import { newResource } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT, type StringKey } from "../i18n/useI18n";

const RESET_KEY: Record<string, StringKey> = {
  shortRest: "reset.shortRest",
  longRest: "reset.longRest",
  dawn: "reset.dawn",
  manual: "reset.manual",
  none: "reset.none",
};

const CATEGORIES = ["spellSlot", "points", "dice", "charges", "ammo", "custom"] as const;
const RESETS = ["shortRest", "longRest", "dawn", "manual", "none"] as const;

/** Full CRUD editor for the generic resource tracker. */
function ResourcesEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);

  const categoryOptions = CATEGORIES.map((v) => ({ value: v, label: t(`rescat.${v}` as StringKey) }));
  const resetOptions = RESETS.map((v) => ({ value: v, label: t(RESET_KEY[v]) }));

  return (
    <Panel title={t("resources.title")} id="resources">
      <EntryList onAdd={() => addItem(["resources"], newResource())} addLabel={t("resource.addResource")}>
        {c.resources.map((r, i) => (
          <EntryRow key={r.id || i} onRemove={() => removeItem(["resources"], i)} removeLabel={t("edit.remove")}>
            <Field label={t("resource.label")}>
              <TextInput value={r.label} onChange={(v) => editField(["resources", i, "label"], v)} label={t("resource.label")} />
            </Field>
            <Field label={t("resource.category")}>
              <Select
                value={r.category}
                onChange={(v) => editField(["resources", i, "category"], v)}
                options={categoryOptions}
                label={t("resource.category")}
              />
            </Field>
            <Field label={t("resource.current")}>
              <NumberInput value={r.current} min={0} onChange={(v) => editField(["resources", i, "current"], v)} label={t("resource.current")} />
            </Field>
            <Field label={t("resource.max")}>
              <NumberInput value={r.max} min={0} onChange={(v) => editField(["resources", i, "max"], v)} label={t("resource.max")} />
            </Field>
            <Field label={t("resource.resetOn")}>
              <Select
                value={r.resetOn}
                onChange={(v) => editField(["resources", i, "resetOn"], v)}
                options={resetOptions}
                label={t("resource.resetOn")}
              />
            </Field>
            <OptionalNumber
              value={r.level}
              min={0}
              max={9}
              label={t("resource.spellLevel")}
              onChange={(v) => editField(["resources", i, "level"], v)}
            />
            <Field label={t("resource.link")}>
              <TextInput
                value={r.link ?? ""}
                onChange={(v) => editField(["resources", i, "link"], v === "" ? null : v)}
                label={t("resource.link")}
              />
            </Field>
          </EntryRow>
        ))}
      </EntryList>
    </Panel>
  );
}

export function ResourcesSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  const adjustResource = useCharacter((s) => s.adjustResource);
  if (editMode) return <ResourcesEdit c={c} />;
  if (c.resources.length === 0) return null;

  return (
    <Panel title={t("resources.title")} id="resources">
      <ul className="resource-list">
        {c.resources.map((r) => {
          const pips = Math.min(r.max, 24);
          return (
            <li key={r.id} className="resource">
              <div className="resource-head">
                <WikiLink link={r.link}>
                  <span className="resource-label">{r.label || r.id}</span>
                </WikiLink>
                <Stepper
                  value={r.current}
                  min={0}
                  max={r.max}
                  label={r.label || r.id}
                  onChange={(next) => adjustResource(r.id, next - r.current)}
                />
              </div>
              {pips > 0 && (
                <div className="pips" aria-hidden>
                  {Array.from({ length: pips }).map((_, i) => (
                    <span key={i} className={i < r.current ? "pip is-on" : "pip"} />
                  ))}
                </div>
              )}
              <span className="resource-meta">
                {r.current}/{r.max} · {t("resources.reset")}: {t(RESET_KEY[r.resetOn] ?? "reset.none")}
                {r.level ? ` · ${t("resources.level")} ${r.level}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
