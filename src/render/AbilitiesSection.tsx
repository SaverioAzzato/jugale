import { AbilityId, type Character } from "../schema";
import { abilityModifierFor, savingThrowBonus } from "../schema";
import { Panel, fmtMod } from "./primitives";
import { useCharacter } from "../state/store";
import { useT, type StringKey } from "../i18n/useI18n";
import { NumberInput, Toggle, OptionalNumber } from "./editControls";

export function AbilitiesSection({ c }: { c: Character }) {
  const t = useT();
  const editMode = useCharacter((s) => s.editMode);
  const editField = useCharacter((s) => s.editField);

  return (
    <Panel plain title={t("abilities.title")} id="abilities">
      <div className="ability-grid">
        {AbilityId.options.map((id) => {
          const a = c.abilities[id];
          return (
            <div key={id} className="ability-card">
              {editMode ? (
                <>
                  <span className="ability-label-row">
                    <span className="ability-label">{t(`ability.${id}` as StringKey)}</span>
                    <span className="ability-mod">{fmtMod(abilityModifierFor(c, id))}</span>
                  </span>
                  <NumberInput
                    value={a.score}
                    min={1}
                    max={30}
                    label={t("abilities.score")}
                    onChange={(v) => editField(["abilities", id, "score"], v)}
                  />
                  <div className="ability-edit-extra">
                    <Toggle
                      checked={a.saveProficient}
                      label={t("abilities.saveProf")}
                      onChange={(v) => editField(["abilities", id, "saveProficient"], v)}
                    />
                    <OptionalNumber
                      value={a.modifierOverride}
                      label={t("edit.modifierOverride")}
                      onChange={(v) => editField(["abilities", id, "modifierOverride"], v)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <span className="ability-label">{t(`ability.${id}` as StringKey)}</span>
                  <strong className="ability-score">{a.score}</strong>
                  <span className="ability-mod">{fmtMod(abilityModifierFor(c, id))}</span>
                  <span className="ability-save">
                    {t("abilities.save")} {fmtMod(savingThrowBonus(c, id))}
                    {a.saveProficient ? " ●" : ""}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
