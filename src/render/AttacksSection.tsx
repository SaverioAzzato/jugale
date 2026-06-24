import { useState } from "react";
import type { Character, AttackProfile } from "../schema";
import { Panel, WikiLink } from "./primitives";
import { useT } from "../i18n/useI18n";

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
function profileLine(p: AttackProfile): string {
  return [p.range, p.attack, p.defense, p.effect].map((x) => x?.trim()).filter(Boolean).join(" · ");
}

function AttackRow({ a }: { a: AttackView }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const dimmed = a.source === "weapon" && !a.available;
  const summary =
    a.profiles.length > 1
      ? `${a.profiles.length} ${t("attacks.modes")}`
      : profileLine(a.profiles[0] ?? ({} as AttackProfile));

  return (
    <li className={dimmed ? "attack is-dimmed" : "attack"}>
      <button type="button" className="attack-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="attack-caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
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
              {p.range && <div className="detail-row"><dt>{t("detail.range")}</dt><dd>{p.range}</dd></div>}
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

/** Weapon attacks (derived from inventory items) + innate attacks, in one list. */
export function AttacksSection({ c }: { c: Character }) {
  const t = useT();
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
