import { AbilityId, type Character } from "../schema";
import { Panel } from "./primitives";
import { useCharacter } from "../state/store";
import { useT, type StringKey } from "../i18n/useI18n";
import { Field, TextInput, NumberInput, Select, EntryList, EntryRow } from "./editControls";
import { newClass } from "../model/factories";

/** Edit-only panel (Attributes tab): the identity fields + the multiclass list.
 *  In play mode these surface as the header subtitle and the Bio block, so there's
 *  nothing to show here — the section renders only while editing. */
export function IdentitySection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);
  if (!editMode) return null;

  const identity = c.identity as Record<string, unknown>;
  const idFields: [string, StringKey][] = [
    ["race", "identity.race"],
    ["lineage", "identity.lineage"],
    ["background", "identity.background"],
    ["alignment", "bio.alignment"],
    ["size", "bio.size"],
    ["age", "bio.age"],
  ];

  const abilityOptions = [
    { value: "", label: t("edit.none") },
    ...AbilityId.options.map((a) => ({ value: a, label: t(`ability.${a}` as StringKey) })),
  ];

  return (
    <Panel title={t("identity.title")} id="identity">
      <div className="edit-grid">
        <Field label={t("identity.player")}>
          <TextInput
            value={c.meta.player}
            onChange={(v) => editField(["meta", "player"], v)}
            label={t("identity.player")}
          />
        </Field>
        {idFields.map(([key, labelKey]) => (
          <Field key={key} label={t(labelKey)}>
            <TextInput
              value={(identity[key] as string | undefined) ?? ""}
              onChange={(v) => editField(["identity", key], v)}
              label={t(labelKey)}
            />
          </Field>
        ))}
      </div>

      <h3 className="edit-subhead">{t("identity.classes")}</h3>
      <EntryList onAdd={() => addItem(["classes"], newClass())} addLabel={t("identity.addClass")}>
        {c.classes.map((cl, i) => (
          <EntryRow key={i} onRemove={() => removeItem(["classes"], i)} removeLabel={t("edit.remove")}>
            <Field label={t("class.name")}>
              <TextInput
                value={cl.name}
                onChange={(v) => editField(["classes", i, "name"], v)}
                label={t("class.name")}
              />
            </Field>
            <Field label={t("class.subclass")}>
              <TextInput
                value={cl.subclass}
                onChange={(v) => editField(["classes", i, "subclass"], v)}
                label={t("class.subclass")}
              />
            </Field>
            <Field label={t("header.level")}>
              <NumberInput
                value={cl.level}
                min={1}
                max={20}
                onChange={(v) => editField(["classes", i, "level"], v)}
                label={t("header.level")}
              />
            </Field>
            <Field label={t("class.hitDie")}>
              <TextInput
                value={cl.hitDie}
                onChange={(v) => editField(["classes", i, "hitDie"], v)}
                label={t("class.hitDie")}
              />
            </Field>
            <Field label={t("class.spellAbility")}>
              <Select
                value={cl.spellcasting.ability ?? ""}
                onChange={(v) => editField(["classes", i, "spellcasting", "ability"], v === "" ? null : v)}
                options={abilityOptions}
                label={t("class.spellAbility")}
              />
            </Field>
            <Field label={t("class.casting")}>
              <Select
                value={cl.spellcasting.type}
                onChange={(v) => editField(["classes", i, "spellcasting", "type"], v)}
                options={[
                  { value: "none", label: t("cast.none") },
                  { value: "known", label: t("cast.known") },
                  { value: "prepared", label: t("cast.prepared") },
                ]}
                label={t("class.casting")}
              />
            </Field>
            <Field label={t("class.slots")}>
              <Select
                value={cl.spellcasting.slotProgression}
                onChange={(v) => editField(["classes", i, "spellcasting", "slotProgression"], v)}
                options={[
                  { value: "none", label: t("slots.none") },
                  { value: "full", label: t("slots.full") },
                  { value: "half", label: t("slots.half") },
                  { value: "third", label: t("slots.third") },
                  { value: "warlock", label: t("slots.warlock") },
                ]}
                label={t("class.slots")}
              />
            </Field>
          </EntryRow>
        ))}
      </EntryList>
    </Panel>
  );
}
