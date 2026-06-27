import { useState } from "react";
import type { Character, AttackProfile } from "../schema";
import { Caret, Panel, WikiLink } from "./primitives";
import { Field, TextInput, EntryList, EntryRow } from "./editControls";
import { newInnateAttack } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT } from "../i18n/useI18n";
import { useSettings, type UnitSystem } from "../ui/useSettings";
import { convertDistanceText } from "../model/units";

interface AttackView {
  key: string;
  name: string;
  link?: string | null;
  source: "weapon" | "innate";
  /** Weapons can be out of hand; innate attacks are always available. */
  available: boolean;
  level?: string;
  profiles: AttackProfile[];
}

/** Summarise a profile as the one-liner you say at the table. */
function profileLine(p: AttackProfile, units: UnitSystem): string {
  return [convertDistanceText(p.range, units), p.attack, p.defense, p.effect]
    .map((x) => x?.trim())
    .filter(Boolean)
    .join(" · ");
}

function AttackRow({ a }: { a: AttackView }) {
  const t = useT();
  const units = useSettings((s) => s.units);
  const [open, setOpen] = useState(false);
  const dimmed = a.source === "weapon" && !a.available;
  const summary =
    a.profiles.length > 1
      ? `${a.profiles.length} ${t("attacks.modes")}`
      : profileLine(a.profiles[0] ?? ({} as AttackProfile), units);

  return (
    <li className={dimmed ? "attack is-dimmed" : "attack"}>
      <button type="button" className="attack-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Caret open={open} />
        <span className="attack-main">
          <span className="attack-name">
            {a.name}
            {a.source === "innate" && <span className="attack-tag">{t("attacks.innate")}</span>}
          </span>
          <span className="attack-summary">
            {dimmed ? t("attacks.notInHand") : summary}
          </span>
        </span>
      </button>
      {open && (
        <div className="attack-body">
          {a.link && (
            <p className="attack-link">
              <WikiLink link={a.link}>{t("detail.openWiki")}</WikiLink>
            </p>
          )}
          {a.profiles.map((p, i) => (
            <dl key={i} className="attack-profile">
              {p.label && <dt className="attack-profile-label">{p.label}</dt>}
              {p.range && <div className="detail-row"><dt>{t("detail.range")}</dt><dd>{convertDistanceText(p.range, units)}</dd></div>}
              {p.attack && <div className="detail-row"><dt>{t("detail.yourRoll")}</dt><dd>{p.attack}</dd></div>}
              {p.defense && <div className="detail-row"><dt>{t("detail.enemyRoll")}</dt><dd>{p.defense}</dd></div>}
              {p.effect && <div className="detail-row"><dt>{t("detail.damageEffect")}</dt><dd>{p.effect}</dd></div>}
              {p.notes && <div className="detail-row"><dt>{t("detail.notes")}</dt><dd>{p.notes}</dd></div>}
            </dl>
          ))}
        </div>
      )}
    </li>
  );
}

/** Edit mode shows only the innate attacks (combat.attacks); weapon attacks are
 *  edited on their inventory item, so they're not duplicated here. */
function InnateAttacksEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);

  return (
    <Panel title={t("attacks.title")} id="attacks">
      <EntryList onAdd={() => addItem(["combat", "attacks"], newInnateAttack())} addLabel={t("attacks.addInnate")}>
        {c.combat.attacks.map((a, i) => (
          <EntryRow key={i} onRemove={() => removeItem(["combat", "attacks"], i)} removeLabel={t("edit.remove")}>
            <Field label={t("attack.name")}>
              <TextInput value={a.name} onChange={(v) => editField(["combat", "attacks", i, "name"], v)} label={t("attack.name")} />
            </Field>
            <Field label={t("header.level")}>
              <TextInput value={a.level} onChange={(v) => editField(["combat", "attacks", i, "level"], v)} label={t("header.level")} />
            </Field>
            <Field label={t("detail.range")}>
              <TextInput value={a.range} onChange={(v) => editField(["combat", "attacks", i, "range"], v)} label={t("detail.range")} />
            </Field>
            <Field label={t("detail.yourRoll")}>
              <TextInput value={a.attack} onChange={(v) => editField(["combat", "attacks", i, "attack"], v)} label={t("detail.yourRoll")} />
            </Field>
            <Field label={t("detail.enemyRoll")}>
              <TextInput value={a.defense} onChange={(v) => editField(["combat", "attacks", i, "defense"], v)} label={t("detail.enemyRoll")} />
            </Field>
            <Field label={t("detail.damageEffect")}>
              <TextInput value={a.effect} onChange={(v) => editField(["combat", "attacks", i, "effect"], v)} label={t("detail.damageEffect")} />
            </Field>
            <Field label={t("detail.notes")}>
              <TextInput value={a.notes} onChange={(v) => editField(["combat", "attacks", i, "notes"], v)} label={t("detail.notes")} />
            </Field>
            <Field label={t("resource.link")}>
              <TextInput
                value={a.link ?? ""}
                onChange={(v) => editField(["combat", "attacks", i, "link"], v === "" ? null : v)}
                label={t("resource.link")}
              />
            </Field>
          </EntryRow>
        ))}
      </EntryList>
    </Panel>
  );
}

/** Weapon attacks (derived from inventory items) + innate attacks, in one list. */
export function AttacksSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  if (editMode) return <InnateAttacksEdit c={c} />;
  const weapons: AttackView[] = c.inventory.items
    .filter((it) => it.attacks.length > 0)
    .map((it, i) => ({
      key: `w${i}`,
      name: it.name || "Arma",
      link: it.link,
      source: "weapon",
      available: it.equipped,
      profiles: it.attacks,
    }));

  const innate: AttackView[] = c.combat.attacks.map((a, i) => ({
    key: `i${i}`,
    name: a.name || "Attacco",
    link: a.link,
    source: "innate",
    available: true,
    level: a.level,
    profiles: [{ label: "", range: a.range, attack: a.attack, defense: a.defense, effect: a.effect, notes: a.notes }],
  }));

  const all = [...weapons, ...innate];
  if (all.length === 0) return null;

  return (
    <Panel title={t("attacks.title")} id="attacks">
      <ul className="attack-list">
        {all.map((a) => (
          <AttackRow key={a.key} a={a} />
        ))}
      </ul>
    </Panel>
  );
}
