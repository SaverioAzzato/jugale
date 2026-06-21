import { AbilityId, type Character } from "../schema";
import { abilityModifierFor, savingThrowBonus } from "../schema";
import { Panel, fmtMod } from "./primitives";

const LABEL: Record<string, string> = {
  str: "Forza",
  dex: "Destrezza",
  con: "Costituzione",
  int: "Intelligenza",
  wis: "Saggezza",
  cha: "Carisma",
};

export function AbilitiesSection({ c }: { c: Character }) {
  return (
    <Panel title="Caratteristiche e Tiri Salvezza" id="abilities">
      <div className="ability-grid">
        {AbilityId.options.map((id) => (
          <div key={id} className="ability-card">
            <span className="ability-label">{LABEL[id]}</span>
            <strong className="ability-score">{c.abilities[id].score}</strong>
            <span className="ability-mod">{fmtMod(abilityModifierFor(c, id))}</span>
            <span className="ability-save">
              TS {fmtMod(savingThrowBonus(c, id))}
              {c.abilities[id].saveProficient ? " ●" : ""}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
