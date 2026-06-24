import { AbilityId, type Character } from "../schema";
import { abilityModifierFor, savingThrowBonus } from "../schema";
import { Panel, fmtMod } from "./primitives";
import { useT, type StringKey } from "../i18n/useI18n";

export function AbilitiesSection({ c }: { c: Character }) {
  const t = useT();
  return (
    <Panel plain title={t("abilities.title")} id="abilities">
      <div className="ability-grid">
        {AbilityId.options.map((id) => (
          <div key={id} className="ability-card">
            <span className="ability-label">{t(`ability.${id}` as StringKey)}</span>
            <strong className="ability-score">{c.abilities[id].score}</strong>
            <span className="ability-mod">{fmtMod(abilityModifierFor(c, id))}</span>
            <span className="ability-save">
              {t("abilities.save")} {fmtMod(savingThrowBonus(c, id))}
              {c.abilities[id].saveProficient ? " ●" : ""}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
