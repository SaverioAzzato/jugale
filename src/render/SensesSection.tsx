import type { Character } from "../schema";
import { Panel } from "./primitives";
import { Field, TagListEditor } from "./editControls";
import { useCharacter } from "../state/store";
import { useT, type StringKey } from "../i18n/useI18n";

/** The four damage/condition defense lists, in display order. */
const DEFENSE_GROUPS: [string, StringKey][] = [
  ["resistances", "def.resistances"],
  ["immunities", "def.immunities"],
  ["vulnerabilities", "def.vulnerabilities"],
  ["conditionImmunities", "def.conditionImmunities"],
];

function SensesEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const defenses = c.defenses as unknown as Record<string, string[]>;
  return (
    <Panel title={t("senses.title")} id="senses">
      <div className="edit-grid">
        <div className="edit-subcard">
          <Field label={t("senses.label")}>
            <TagListEditor
              values={c.senses}
              onChange={(next) => editField(["senses"], next)}
              label={t("senses.label")}
              placeholder={t("senses.placeholder")}
            />
          </Field>
        </div>
        {DEFENSE_GROUPS.map(([key, labelKey]) => (
          <div key={key} className="edit-subcard">
            <Field label={t(labelKey)}>
              <TagListEditor
                values={defenses[key] ?? []}
                onChange={(next) => editField(["defenses", key], next)}
                label={t(labelKey)}
              />
            </Field>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function SensesSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  if (editMode) return <SensesEdit c={c} />;

  const d = c.defenses;
  const rows: [StringKey, string[]][] = [
    ["senses.label", c.senses],
    ...DEFENSE_GROUPS.map(([key, labelKey]) => [labelKey, (d as unknown as Record<string, string[]>)[key] ?? []] as [StringKey, string[]]),
  ];
  const present = rows.filter(([, v]) => v.length > 0);
  if (present.length === 0) return null;

  return (
    <Panel title={t("senses.title")} id="senses">
      {present.map(([key, values]) => (
        <p key={key} className="prof-line">
          <strong>{t(key)}:</strong> {values.join(", ")}
        </p>
      ))}
    </Panel>
  );
}
