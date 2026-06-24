import type { Character } from "../schema";
import { SKILLS, skillState } from "../model/skills";
import { Panel, fmtMod } from "./primitives";
import { useT, type StringKey } from "../i18n/useI18n";

export function SkillsSection({ c }: { c: Character }) {
  const t = useT();
  const perception = skillState(c, SKILLS.find((s) => s.id === "perception")!);
  const passivePerception = 10 + perception.bonus;

  return (
    <Panel title={t("skills.title")} id="skills">
      <ul className="skill-list">
        {SKILLS.map((def) => {
          const s = skillState(c, def);
          return (
            <li key={def.id} className={s.proficient ? "skill is-proficient" : "skill"}>
              <span className="skill-dot" aria-hidden>
                {s.expertise ? "◉" : s.proficient ? "●" : "○"}
              </span>
              <span className="skill-name">{t(`skill.${def.id}` as StringKey)}</span>
              <span className="skill-bonus">{fmtMod(s.bonus)}</span>
            </li>
          );
        })}
      </ul>
      <p className="passive-perception">
        {t("skills.passivePerception")}: <strong>{passivePerception}</strong>
      </p>
    </Panel>
  );
}
