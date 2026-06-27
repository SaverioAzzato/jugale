import type { Character } from "../schema";
import { SKILLS, skillState, type SkillDef } from "../model/skills";
import { Panel, fmtMod } from "./primitives";
import { Toggle } from "./editControls";
import { newSkill } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT, type StringKey } from "../i18n/useI18n";

const norm = (id: string): string => id.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Edit mode: a proficient/expertise toggle per skill, writing to proficiencies.skills
 *  (creating the entry on first toggle if the skill isn't tracked yet). */
function SkillsEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const indexOf = (id: string) => c.proficiencies.skills.findIndex((s) => norm(s.id) === norm(id));

  const setFlag = (def: SkillDef, field: "proficient" | "expertise", v: boolean) => {
    const idx = indexOf(def.id);
    if (idx >= 0) editField(["proficiencies", "skills", idx, field], v);
    else addItem(["proficiencies", "skills"], { ...newSkill(def.id), [field]: v });
  };

  return (
    <Panel title={t("skills.editTitle")} id="skills">
      <ul className="edit-skill-list">
        {SKILLS.map((def) => {
          const idx = indexOf(def.id);
          const entry = idx >= 0 ? c.proficiencies.skills[idx] : null;
          return (
            <li key={def.id} className="edit-skill-row">
              <span className="skill-name">{t(`skill.${def.id}` as StringKey)}</span>
              <Toggle
                checked={entry?.proficient ?? false}
                label={t("skills.proficient")}
                onChange={(v) => setFlag(def, "proficient", v)}
              />
              <Toggle
                checked={entry?.expertise ?? false}
                label={t("skills.expertise")}
                onChange={(v) => setFlag(def, "expertise", v)}
              />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function SkillsSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  if (editMode) return <SkillsEdit c={c} />;

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
