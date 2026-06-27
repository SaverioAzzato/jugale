import { useState } from "react";
import { type AbilityId, type Character, type SpellEntry } from "../schema";
import { spellSaveDc, spellAttackBonus } from "../schema";
import { Caret, Panel, WikiLink, fmtMod } from "./primitives";
import { Field, TextInput, Toggle, EntryList, EntryRow } from "./editControls";
import { newSpell, newSpellSection } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT } from "../i18n/useI18n";
import { useSettings, type UnitSystem } from "../ui/useSettings";
import { convertDistanceText } from "../model/units";

/** The one-liner you read at the table when the spell is collapsed. */
function spellLine(s: SpellEntry, units: UnitSystem): string {
  return [convertDistanceText(s.range, units), s.attack, s.defense, s.effect]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(" · ");
}

/** description and notes are one concept now — show them merged. */
function mergedText(s: SpellEntry): string {
  return [s.description?.trim(), s.notes?.trim()].filter(Boolean).join("\n\n");
}

function SpellRow({ s }: { s: SpellEntry }) {
  const t = useT();
  const units = useSettings((settings) => settings.units);
  const [open, setOpen] = useState(false);
  const text = mergedText(s);
  return (
    <li className="spell">
      <button type="button" className="spell-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Caret open={open} />
        <span className="attack-main">
          <span className="attack-name">
            {s.name}
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
            {s.castingTime && <div className="detail-row"><dt>{t("spells.castingTime")}</dt><dd>{s.castingTime}</dd></div>}
            {s.range && <div className="detail-row"><dt>{t("detail.range")}</dt><dd>{convertDistanceText(s.range, units)}</dd></div>}
            {s.area && <div className="detail-row"><dt>{t("spells.area")}</dt><dd>{convertDistanceText(s.area, units)}</dd></div>}
            {s.duration && (
              <div className="detail-row">
                <dt>{t("spells.duration")}</dt>
                <dd>{convertDistanceText(s.duration, units)}{s.concentration ? ` · ${t("spells.concentrationFull")}` : ""}</dd>
              </div>
            )}
            {s.components && <div className="detail-row"><dt>{t("spells.components")}</dt><dd>{s.components}</dd></div>}
            {s.attack && <div className="detail-row"><dt>{t("detail.yourRoll")}</dt><dd>{s.attack}</dd></div>}
            {s.defense && <div className="detail-row"><dt>{t("detail.enemyRoll")}</dt><dd>{s.defense}</dd></div>}
            {s.effect && <div className="detail-row"><dt>{t("detail.damageEffect")}</dt><dd>{s.effect}</dd></div>}
          </dl>
          {text && <p className="spell-desc">{text}</p>}
        </div>
      )}
    </li>
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
      {text("effect", t("detail.damageEffect"))}
      <div className="edit-checks">
        <Toggle checked={s.concentration} label={t("spell.concentration")} onChange={(v) => set("concentration", v)} />
        <Toggle checked={s.prepared} label={t("spell.prepared")} onChange={(v) => set("prepared", v)} />
      </div>
      <details className="edit-sub">
        <summary>{t("edit.description")}…</summary>
        <div className="edit-grid">
          {text("school", t("spells.school"))}
          {text("castingTime", t("spells.castingTime"))}
          {text("area", t("spells.area"))}
          {text("duration", t("spells.duration"))}
          {text("components", t("spells.components"))}
          <Field label={t("resource.link")}>
            <TextInput
              value={s.link ?? ""}
              onChange={(v) => set("link", v === "" ? null : v)}
              label={t("resource.link")}
            />
          </Field>
        </div>
        {text("description", t("edit.description"), true)}
        {text("notes", t("detail.notes"), true)}
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
