import type { Character } from "../schema";
import { SKILLS, skillState } from "../model/skills";
import { Panel, fmtMod } from "./primitives";

export function SkillsSection({ c }: { c: Character }) {
  return (
    <Panel title="Abilità" id="skills">
      <ul className="skill-list">
        {SKILLS.map((def) => {
          const s = skillState(c, def);
          return (
            <li key={def.id} className={s.proficient ? "skill is-proficient" : "skill"}>
              <span className="skill-dot" aria-hidden>
                {s.expertise ? "◉" : s.proficient ? "●" : "○"}
              </span>
              <span className="skill-name">{def.label}</span>
              <span className="skill-bonus">{fmtMod(s.bonus)}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
