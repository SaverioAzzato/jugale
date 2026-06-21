import type { ReactNode } from "react";
import type { Character } from "../schema";
import { abilityModifierFor } from "../schema";
import { Panel, fmtMod, DataTable, WikiLink } from "./primitives";

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </div>
  );
}

export function CombatSection({ c }: { c: Character }) {
  const initiative = c.combat.initiativeOverride ?? abilityModifierFor(c, "dex");
  const hp = c.combat.hp;
  return (
    <Panel title="Combattimento" id="combat">
      <div className="stat-row">
        <Stat label="CA" value={c.combat.armorClass} />
        <Stat label="Iniziativa" value={fmtMod(initiative)} />
        <Stat label="Velocità" value={`${c.combat.speed.walk} ft`} />
        <Stat label="PF" value={`${hp.current}/${hp.max}${hp.temp ? ` (+${hp.temp})` : ""}`} />
      </div>
      {c.combat.attacks.length > 0 && (
        <DataTable
          headers={["Opzione", "Livello", "Gittata", "Tiro che fai tu", "Tiro avversario", "Danno/Effetto", "Note"]}
          rows={c.combat.attacks.map((a) => [
            <WikiLink link={a.link}>{a.name}</WikiLink>,
            a.level,
            a.range,
            a.attack,
            a.defense,
            a.effect,
            a.notes,
          ])}
        />
      )}
    </Panel>
  );
}
