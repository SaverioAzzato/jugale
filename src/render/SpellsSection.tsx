import { useState } from "react";
import {
  type AbilityId,
  type Character,
  type SpellEntry,
  type SpellCastingTime,
  type SpellMaterial,
} from "../schema";
import { spellSaveDc, spellAttackBonus } from "../schema";
import { Caret, Panel, WikiLink, fmtMod } from "./primitives";
import { Field, TextInput, Toggle, OptionalNumber, EntryList, EntryRow } from "./editControls";
import { newSpell, newSpellSection, newSpellMaterial } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT, type TFn } from "../i18n/useI18n";
import { useSettings, type UnitSystem } from "../ui/useSettings";
import { convertDistanceText } from "../model/units";

/** Human-readable casting time from the structured field. */
function castingTimeText(ct: SpellCastingTime, t: TFn): string {
  switch (ct.type) {
    case "bonus":
      return t("spells.ct.bonus");
    case "reaction":
      return ct.condition ? `${t("spells.ct.reaction")} (${ct.condition})` : t("spells.ct.reaction");
    case "time":
      return ct.value || t("spells.ct.time");
    default:
      return t("spells.ct.action");
  }
}

/** "V · S · M" from the component flags (empty when the spell has none). */
function componentsText(c: SpellEntry["components"]): string {
  return [c.verbal && "V", c.somatic && "S", c.material && "M"].filter(Boolean).join(" · ");
}

/** Effect + its damage type, if split out ("1d10" + "force" → "1d10 force"). */
function effectText(s: SpellEntry): string {
  return [s.effect?.trim(), s.damageType?.trim()].filter(Boolean).join(" ");
}

/** The one-liner you read at the table when the spell is collapsed. */
function spellLine(s: SpellEntry, units: UnitSystem): string {
  return [convertDistanceText(s.range, units), s.attack, s.defense, effectText(s)]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(" · ");
}

/** A single material component, with its cost and whether the spell consumes it. */
function MaterialLine({ m, t }: { m: SpellMaterial; t: TFn }) {
  return (
    <li className={m.consumable ? "spell-material is-consumable" : "spell-material"}>
      {m.text}
      {m.cost != null && <span className="spell-material-cost"> ({m.cost} {t("spells.gold")})</span>}
      <span className="spell-material-tag">{m.consumable ? t("spells.consumable") : t("spells.reusable")}</span>
    </li>
  );
}

function SpellRow({ s }: { s: SpellEntry }) {
  const t = useT();
  const units = useSettings((settings) => settings.units);
  const [open, setOpen] = useState(false);
  const text = s.description?.trim() ?? "";
  const comps = componentsText(s.components);
  const materials = s.components.material ? s.materials : [];
  return (
    <li className="spell">
      <button type="button" className="spell-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Caret open={open} />
        <span className="attack-main">
          <span className="attack-name">
            {s.name}
            {s.ritual && <span className="attack-tag">{t("spells.ritual")}</span>}
            {s.concentration && <span className="attack-tag">{t("spells.concentration")}</span>}
          </span>
          <span className="attack-summary">{spellLine(s, units)}</span>
        </span>
      </button>
      {open && (
        <div className="attack-body">
          {s.link && (
            <p className="attack-link">
              <WikiLink link={s.link}>{t("detail.openWiki")}</WikiLink>
            </p>
          )}
          <dl className="attack-profile">
            {s.school && <div className="detail-row"><dt>{t("spells.school")}</dt><dd>{s.school}</dd></div>}
            <div className="detail-row"><dt>{t("spells.castingTime")}</dt><dd>{castingTimeText(s.castingTime, t)}</dd></div>
            {s.range && <div className="detail-row"><dt>{t("detail.range")}</dt><dd>{convertDistanceText(s.range, units)}</dd></div>}
            {s.area && <div className="detail-row"><dt>{t("spells.area")}</dt><dd>{convertDistanceText(s.area, units)}</dd></div>}
            {s.duration && (
              <div className="detail-row">
                <dt>{t("spells.duration")}</dt>
                <dd>{convertDistanceText(s.duration, units)}{s.concentration ? ` · ${t("spells.concentrationFull")}` : ""}</dd>
              </div>
            )}
            {comps && <div className="detail-row"><dt>{t("spells.components")}</dt><dd>{comps}</dd></div>}
            {materials.length > 0 && (
              <div className="detail-row">
                <dt>{t("spells.materials")}</dt>
                <dd>
                  <ul className="spell-materials">
                    {materials.map((m, i) => (
                      <MaterialLine key={i} m={m} t={t} />
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {s.attack && <div className="detail-row"><dt>{t("detail.yourRoll")}</dt><dd>{s.attack}</dd></div>}
            {s.defense && <div className="detail-row"><dt>{t("detail.enemyRoll")}</dt><dd>{s.defense}</dd></div>}
            {effectText(s) && <div className="detail-row"><dt>{t("detail.damageEffect")}</dt><dd>{effectText(s)}</dd></div>}
            {s.higherLevels && <div className="detail-row"><dt>{t("spells.higherLevels")}</dt><dd>{s.higherLevels}</dd></div>}
          </dl>
          {text && <p className="spell-desc">{text}</p>}
        </div>
      )}
    </li>
  );
}

/** Segmented control for the casting-time type — a quick pick instead of typing. */
function CastingTimePicker({ ct, path }: { ct: SpellCastingTime; path: (string | number)[] }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const kinds: { value: SpellCastingTime["type"]; label: string }[] = [
    { value: "action", label: t("spells.ct.action") },
    { value: "bonus", label: t("spells.ct.bonus") },
    { value: "reaction", label: t("spells.ct.reaction") },
    { value: "time", label: t("spells.ct.timeShort") },
  ];
  return (
    <Field label={t("spells.castingTime")}>
      <div className="ct-picker" role="group" aria-label={t("spells.castingTime")}>
        {kinds.map((k) => (
          <button
            key={k.value}
            type="button"
            className={ct.type === k.value ? "ct-opt is-active" : "ct-opt"}
            aria-pressed={ct.type === k.value}
            onClick={() => editField([...path, "castingTime", "type"], k.value)}
          >
            {k.label}
          </button>
        ))}
      </div>
      {ct.type === "time" && (
        <TextInput
          value={ct.value}
          onChange={(v) => editField([...path, "castingTime", "value"], v)}
          label={t("spells.ct.timeShort")}
        />
      )}
      {ct.type === "reaction" && (
        <TextInput
          value={ct.condition}
          onChange={(v) => editField([...path, "castingTime", "condition"], v)}
          label={t("spells.reactionCondition")}
        />
      )}
    </Field>
  );
}

/** The materials list, shown only when the spell has a material component. */
function MaterialsEditor({ s, path }: { s: SpellEntry; path: (string | number)[] }) {
  const t = useT();
  const editField = useCharacter((st) => st.editField);
  const addItem = useCharacter((st) => st.addItem);
  const removeItem = useCharacter((st) => st.removeItem);
  const base = [...path, "materials"];
  return (
    <div className="edit-materials">
      <span className="edit-field-label">{t("spells.materials")}</span>
      <EntryList onAdd={() => addItem(base, newSpellMaterial())} addLabel={t("spells.addMaterial")}>
        {s.materials.map((m, mi) => (
          <EntryRow key={mi} onRemove={() => removeItem(base, mi)} removeLabel={t("edit.remove")}>
            <Field label={t("spells.material")}>
              <TextInput value={m.text} onChange={(v) => editField([...base, mi, "text"], v)} label={t("spells.material")} />
            </Field>
            <div className="edit-checks">
              <OptionalNumber
                value={m.cost}
                min={0}
                label={t("spells.cost")}
                onChange={(v) => editField([...base, mi, "cost"], v)}
              />
              <Toggle checked={m.consumable} label={t("spells.consumable")} onChange={(v) => editField([...base, mi, "consumable"], v)} />
            </div>
          </EntryRow>
        ))}
      </EntryList>
    </div>
  );
}

/** Editor for one spell entry: a few key fields, the rest under a disclosure. */
function SpellEditor({ s, path }: { s: SpellEntry; path: (string | number)[] }) {
  const t = useT();
  const editField = useCharacter((st) => st.editField);
  const set = (field: keyof SpellEntry, v: unknown) => editField([...path, field], v);
  const text = (field: keyof SpellEntry, label: string, multiline?: boolean) => (
    <Field label={label}>
      <TextInput value={String(s[field] ?? "")} multiline={multiline} onChange={(v) => set(field, v)} label={label} />
    </Field>
  );
  return (
    <>
      {text("name", t("item.name"))}
      {text("level", t("header.level"))}
      {text("range", t("detail.range"))}
      {text("attack", t("detail.yourRoll"))}
      {text("defense", t("detail.enemyRoll"))}
      <div className="edit-grid">
        {text("effect", t("detail.damageEffect"))}
        {text("damageType", t("spells.damageType"))}
      </div>
      <div className="edit-checks">
        <Toggle checked={s.components.verbal} label={t("spells.verbal")} onChange={(v) => set("components", { ...s.components, verbal: v })} />
        <Toggle checked={s.components.somatic} label={t("spells.somatic")} onChange={(v) => set("components", { ...s.components, somatic: v })} />
        <Toggle checked={s.components.material} label={t("spells.materialComp")} onChange={(v) => set("components", { ...s.components, material: v })} />
      </div>
      {s.components.material && <MaterialsEditor s={s} path={path} />}
      <div className="edit-checks">
        <Toggle checked={s.concentration} label={t("spell.concentration")} onChange={(v) => set("concentration", v)} />
        <Toggle checked={s.ritual} label={t("spells.ritual")} onChange={(v) => set("ritual", v)} />
        <Toggle checked={s.prepared} label={t("spell.prepared")} onChange={(v) => set("prepared", v)} />
      </div>
      <details className="edit-sub">
        <summary>{t("edit.description")}…</summary>
        <CastingTimePicker ct={s.castingTime} path={path} />
        <div className="edit-grid">
          {text("school", t("spells.school"))}
          {text("area", t("spells.area"))}
          {text("duration", t("spells.duration"))}
          <Field label={t("resource.link")}>
            <TextInput
              value={s.link ?? ""}
              onChange={(v) => set("link", v === "" ? null : v)}
              label={t("resource.link")}
            />
          </Field>
        </div>
        {text("higherLevels", t("spells.higherLevels"), true)}
        {text("description", t("edit.description"), true)}
      </details>
    </>
  );
}

/** Full CRUD for spell sections and their spells. */
function SpellsEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);

  return (
    <Panel title={t("spells.title")} id="spells">
      <EntryList onAdd={() => addItem(["spellSections"], newSpellSection())} addLabel={t("spells.addSection")}>
        {c.spellSections.map((sec, si) => (
          <div key={sec.id || si} className="edit-section">
            <button
              type="button"
              className="edit-entry-close"
              onClick={() => removeItem(["spellSections"], si)}
              aria-label={t("edit.remove")}
              title={t("edit.remove")}
            >
              ×
            </button>
            <div className="edit-section-head">
              <Field label={t("spells.sectionTitle")}>
                <TextInput
                  value={sec.title}
                  onChange={(v) => editField(["spellSections", si, "title"], v)}
                  label={t("spells.sectionTitle")}
                />
              </Field>
            </div>
            <EntryList
              onAdd={() => addItem(["spellSections", si, "entries"], newSpell())}
              addLabel={t("spells.addSpell")}
            >
              {sec.entries.map((s, ei) => (
                <EntryRow
                  key={ei}
                  onRemove={() => removeItem(["spellSections", si, "entries"], ei)}
                  removeLabel={t("edit.remove")}
                >
                  <SpellEditor s={s} path={["spellSections", si, "entries", ei]} />
                </EntryRow>
              ))}
            </EntryList>
          </div>
        ))}
      </EntryList>
    </Panel>
  );
}

export function SpellsSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  if (editMode) return <SpellsEdit c={c} />;
  if (c.spellSections.length === 0) return null;
  const casters = c.classes.filter((cl) => cl.spellcasting.ability);

  return (
    <Panel title={t("spells.title")} id="spells">
      {casters.length > 0 && (
        <p className="caster-summary">
          {casters.map((cl, i) => {
            const ability = cl.spellcasting.ability as AbilityId;
            return (
              <span key={i}>
                {i > 0 ? " · " : ""}
                <strong>{cl.name}</strong>: {t("spells.dc")} {spellSaveDc(c, ability)}, {t("spells.attack")}{" "}
                {fmtMod(spellAttackBonus(c, ability))}
              </span>
            );
          })}
        </p>
      )}
      {c.spellSections.map((sec) => (
        <div key={sec.id || sec.title} className="spell-section">
          {sec.title && <h3 className="spell-section-title">{sec.title}</h3>}
          <ul className="spell-list">
            {sec.entries.map((s, i) => (
              <SpellRow key={s.name || i} s={s} />
            ))}
          </ul>
        </div>
      ))}
    </Panel>
  );
}
