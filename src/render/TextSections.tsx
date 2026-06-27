import type { Character } from "../schema";
import { Panel } from "./primitives";
import {
  Field,
  TextInput,
  OptionalNumber,
  TagListEditor,
  StringListEditor,
  EntryList,
  EntryRow,
} from "./editControls";
import { newRaceTrait } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT, type StringKey } from "../i18n/useI18n";

/** The character's free-text summary/description — lives in the Story tab. */
export function DescriptionSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  const editField = useCharacter((s) => s.editField);
  if (editMode) {
    return (
      <Panel plain title={t("description.title")} id="description">
        <TextInput
          value={c.meta.summary}
          multiline
          onChange={(v) => editField(["meta", "summary"], v)}
          label={t("description.title")}
        />
      </Panel>
    );
  }
  if (!c.meta.summary || !c.meta.summary.trim()) return null;
  return (
    <Panel plain title={t("description.title")} id="description">
      <p className="story-summary">{c.meta.summary}</p>
    </Panel>
  );
}

const NARRATIVE_BLOCKS: [string, StringKey][] = [
  ["personality", "narrative.personality"],
  ["ideals", "narrative.ideals"],
  ["bonds", "narrative.bonds"],
  ["flaws", "narrative.flaws"],
  ["appearance", "narrative.appearance"],
  ["backstory", "narrative.backstory"],
  ["notes", "narrative.notes"],
];

/** Bio / vital statistics from the identity block (only the fields that are set). */
export function BioSection({ c }: { c: Character }) {
  const t = useT();
  const rows: [StringKey, string][] = [
    ["bio.alignment", c.identity.alignment],
    ["bio.size", c.identity.size],
    ["bio.age", c.identity.age],
  ];
  const present = rows.filter(([, v]) => v && v.trim().length > 0);
  if (present.length === 0) return null;
  return (
    <Panel title={t("bio.title")} id="bio">
      <dl className="kv">
        {present.map(([key, value]) => (
          <div key={key} className="kv-row">
            <dt>{t(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

const PROF_GROUPS: [string, StringKey][] = [
  ["armor", "prof.armor"],
  ["weapons", "prof.weapons"],
  ["tools", "prof.tools"],
  ["languages", "prof.languages"],
];

function ProficienciesEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const p = c.proficiencies as unknown as Record<string, string[]>;
  return (
    <Panel title={t("prof.title")} id="proficiencies">
      <div className="edit-grid">
        {PROF_GROUPS.map(([key, labelKey]) => (
          <div key={key} className="edit-subcard">
            <Field label={t(labelKey)}>
              <TagListEditor
                values={p[key] ?? []}
                onChange={(next) => editField(["proficiencies", key], next)}
                label={t(labelKey)}
              />
            </Field>
          </div>
        ))}
      </div>
      <div className="edit-grid">
        <OptionalNumber
          value={c.proficiencies.proficiencyBonusOverride}
          label={t("prof.bonusOverride")}
          onChange={(v) => editField(["proficiencies", "proficiencyBonusOverride"], v)}
        />
      </div>
    </Panel>
  );
}

export function ProficienciesSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  if (editMode) return <ProficienciesEdit c={c} />;
  const p = c.proficiencies;
  const groups: [StringKey, string[]][] = [
    ["prof.armor", p.armor],
    ["prof.weapons", p.weapons],
    ["prof.tools", p.tools],
    ["prof.languages", p.languages],
  ];
  if (groups.every(([, v]) => v.length === 0)) return null;
  return (
    <Panel title={t("prof.title")} id="proficiencies">
      {groups
        .filter(([, v]) => v.length > 0)
        .map(([key, values]) => (
          <p key={key} className="prof-line">
            <strong>{t(key)}:</strong> {values.join(", ")}
          </p>
        ))}
    </Panel>
  );
}

function OriginEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);
  const bg = c.origin.backgroundFeature;
  return (
    <Panel title={t("origin.title")} id="origin">
      <EntryList onAdd={() => addItem(["origin", "raceTraits"], newRaceTrait())} addLabel={t("origin.addTrait")}>
        {c.origin.raceTraits.map((tr, i) => (
          <EntryRow key={i} onRemove={() => removeItem(["origin", "raceTraits"], i)} removeLabel={t("edit.remove")}>
            <Field label={t("item.name")}>
              <TextInput value={tr.name} onChange={(v) => editField(["origin", "raceTraits", i, "name"], v)} label={t("item.name")} />
            </Field>
            <Field label={t("edit.description")}>
              <TextInput
                value={tr.description}
                multiline
                onChange={(v) => editField(["origin", "raceTraits", i, "description"], v)}
                label={t("edit.description")}
              />
            </Field>
          </EntryRow>
        ))}
      </EntryList>

      <h3 className="edit-subhead">{t("origin.backgroundFeature")}</h3>
      <Field label={t("origin.hasBgFeature")}>
        <input
          type="checkbox"
          checked={bg != null}
          aria-label={t("origin.hasBgFeature")}
          onChange={(e) =>
            editField(["origin", "backgroundFeature"], e.target.checked ? { name: "", description: "", link: null } : null)
          }
        />
      </Field>
      {bg && (
        <div className="edit-grid">
          <Field label={t("item.name")}>
            <TextInput value={bg.name} onChange={(v) => editField(["origin", "backgroundFeature", "name"], v)} label={t("item.name")} />
          </Field>
          <Field label={t("edit.description")}>
            <TextInput
              value={bg.description}
              multiline
              onChange={(v) => editField(["origin", "backgroundFeature", "description"], v)}
              label={t("edit.description")}
            />
          </Field>
        </div>
      )}
      {/* Languages are edited in Proficiencies (Attributi tab) — their single home. */}
    </Panel>
  );
}

export function OriginSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  if (editMode) return <OriginEdit c={c} />;
  const o = c.origin;
  if (o.raceTraits.length === 0 && !o.backgroundFeature) return null;
  return (
    <Panel title={t("origin.title")} id="origin">
      {o.raceTraits.length > 0 && (
        <ul className="feature-list">
          {o.raceTraits.map((trait, i) => (
            <li key={i}>
              {trait.name ? <strong>{trait.name}</strong> : null}
              {trait.name && trait.description ? ": " : ""}
              {trait.description}
            </li>
          ))}
        </ul>
      )}
      {o.backgroundFeature && (
        <p>
          <strong>{o.backgroundFeature.name}</strong>
          {o.backgroundFeature.description ? `: ${o.backgroundFeature.description}` : ""}
        </p>
      )}
    </Panel>
  );
}

function NarrativeEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const n = c.narrative as unknown as Record<string, string[]>;
  return (
    <Panel title={t("narrative.title")} id="narrative">
      {NARRATIVE_BLOCKS.map(([key, labelKey]) => (
        <div key={key} className="narrative-block">
          <h3>{t(labelKey)}</h3>
          <StringListEditor
            values={n[key] ?? []}
            onChange={(next) => editField(["narrative", key], next)}
            label={t(labelKey)}
            addLabel={t("edit.add")}
            multiline
          />
        </div>
      ))}
    </Panel>
  );
}

export function NarrativeSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  if (editMode) return <NarrativeEdit c={c} />;
  const n = c.narrative;
  const blocks: [StringKey, string[]][] = [
    ["narrative.personality", n.personality],
    ["narrative.ideals", n.ideals],
    ["narrative.bonds", n.bonds],
    ["narrative.flaws", n.flaws],
    ["narrative.appearance", n.appearance],
    ["narrative.backstory", n.backstory],
    ["narrative.notes", n.notes],
  ];
  if (blocks.every(([, v]) => v.length === 0)) return null;
  return (
    <Panel title={t("narrative.title")} id="narrative">
      {blocks
        .filter(([, v]) => v.length > 0)
        .map(([key, values]) => (
          <div key={key} className="narrative-block">
            <h3>{t(key)}</h3>
            <ul className="bullets">
              {values.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        ))}
    </Panel>
  );
}
