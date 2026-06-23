import { useRef, useState, type ReactNode } from "react";
import type { Character } from "../schema";
import { abilityModifierFor, derivedArmorClass, maxHitDice } from "../schema";
import { Panel, fmtMod } from "./primitives";
import { Stepper, useHoldRepeat } from "./controls";
import { useCharacter } from "../state/store";

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

function HpControl({ hp }: { hp: Character["combat"]["hp"] }) {
  const damage = useCharacter((s) => s.damage);
  const heal = useCharacter((s) => s.heal);
  const setCurrentHp = useCharacter((s) => s.setCurrentHp);
  const setTempHp = useCharacter((s) => s.setTempHp);
  const [amount, setAmount] = useState(1);
  const damagePressed = useRef(false);
  const healPressed = useRef(false);
  const pct = hp.max > 0 ? Math.round((hp.current / hp.max) * 100) : 0;

  const holdDamage = useHoldRepeat(() => damage(amount));
  const holdHeal = useHoldRepeat(() => heal(amount));

  const clearPressedSoon = (ref: { current: boolean }) => {
    setTimeout(() => {
      ref.current = false;
    }, 0);
  };

  const startDamage = () => {
    damagePressed.current = true;
    holdDamage.start();
  };
  const stopDamage = () => {
    holdDamage.stop();
    clearPressedSoon(damagePressed);
  };

  const startHeal = () => {
    healPressed.current = true;
    holdHeal.start();
  };
  const stopHeal = () => {
    holdHeal.stop();
    clearPressedSoon(healPressed);
  };

  return (
    <div className="hp-control">
      <div className="hp-readout">
        <strong className="hp-current">{hp.current}</strong>
        <span className="hp-max">/ {hp.max}</span>
        {hp.temp > 0 && <span className="hp-temp">+{hp.temp} temp</span>}
      </div>
      <div className="hp-bar" aria-hidden>
        <div className="hp-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="hp-actions">
        <input
          type="number"
          min={0}
          className="hp-amount"
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          aria-label="quantità"
        />
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (damagePressed.current) {
              damagePressed.current = false;
              return;
            }
            damage(amount);
          }}
          onMouseDown={startDamage}
          onMouseUp={stopDamage}
          onMouseLeave={stopDamage}
          onTouchStart={(e) => {
            e.preventDefault();
            startDamage();
          }}
          onTouchEnd={stopDamage}
        >
          Danno
        </button>
        <button
          type="button"
          className="btn btn-heal"
          onClick={() => {
            if (healPressed.current) {
              healPressed.current = false;
              return;
            }
            heal(amount);
          }}
          onMouseDown={startHeal}
          onMouseUp={stopHeal}
          onMouseLeave={stopHeal}
          onTouchStart={(e) => {
            e.preventDefault();
            startHeal();
          }}
          onTouchEnd={stopHeal}
        >
          Cura
        </button>
      </div>
      <div className="hp-fine">
        <label>
          PF{" "}
          <Stepper
            value={hp.current}
            max={hp.max || undefined}
            onChange={setCurrentHp}
            label="PF correnti"
          />
        </label>
        <label>
          Temp{" "}
          <Stepper value={hp.temp} onChange={setTempHp} label="PF temporanei" />
        </label>
      </div>
    </div>
  );
}

function HitDiceControl({ c }: { c: Character }) {
  const adjustHitDice = useCharacter((s) => s.adjustHitDice);
  const max = maxHitDice(c);
  if (max <= 0) return null;
  return (
    <div className="hp-fine">
      <label>
        Dadi Vita{" "}
        <Stepper
          value={c.combat.hp.hitDiceRemaining}
          max={max}
          onChange={(next) => adjustHitDice(next - c.combat.hp.hitDiceRemaining)}
          label="Dadi Vita rimasti"
        />
        <span className="muted"> / {max}</span>
      </label>
    </div>
  );
}

export function CombatSection({ c }: { c: Character }) {
  const shortRest = useCharacter((s) => s.shortRest);
  const longRest = useCharacter((s) => s.longRest);
  const initiative = c.combat.initiativeOverride ?? abilityModifierFor(c, "dex");
  const ac = derivedArmorClass(c);

  return (
    <Panel title="Vitali" id="combat">
      <div className="stat-row">
        <Stat label="CA" value={ac.value} note={ac.breakdown || undefined} />
        <Stat label="Iniziativa" value={fmtMod(initiative)} />
        <Stat label="Velocità" value={`${c.combat.speed.walk} ft`} />
      </div>

      <HpControl hp={c.combat.hp} />
      <HitDiceControl c={c} />

      <div className="rest-actions">
        <button type="button" className="btn" onClick={shortRest}>
          Riposo breve
        </button>
        <button type="button" className="btn" onClick={longRest}>
          Riposo lungo
        </button>
      </div>
    </Panel>
  );
}
