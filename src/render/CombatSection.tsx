import { useRef, type ReactNode } from "react";
import type { Character } from "../schema";
import { abilityModifierFor, derivedArmorClass, maxHitDice } from "../schema";
import { Panel, fmtMod } from "./primitives";
import { Stepper, useHoldRepeat } from "./controls";
import { Field, NumberInput, OptionalNumber } from "./editControls";
import { useCharacter } from "../state/store";
import { useT } from "../i18n/useI18n";
import { useSettings } from "../ui/useSettings";
import { formatDistance } from "../model/units";

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

function HpControl({ c }: { c: Character }) {
  const t = useT();
  const hp = c.combat.hp;
  const damage = useCharacter((s) => s.damage);
  const heal = useCharacter((s) => s.heal);
  const setCurrentHp = useCharacter((s) => s.setCurrentHp);
  const setTempHp = useCharacter((s) => s.setTempHp);
  const adjustHitDice = useCharacter((s) => s.adjustHitDice);
  const maxHd = maxHitDice(c);
  const damagePressed = useRef(false);
  const healPressed = useRef(false);
  const pct = hp.max > 0 ? Math.round((hp.current / hp.max) * 100) : 0;

  // Damage/Heal apply 1 per activation, but hold-to-repeat ramps it up for bigger hits.
  const holdDamage = useHoldRepeat(() => damage(1));
  const holdHeal = useHoldRepeat(() => heal(1));

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
        <span className="hp-label">{t("vitals.hp")}</span>
        <strong className="hp-current">{hp.current}</strong>
        <span className="hp-max">/ {hp.max}</span>
        {hp.temp > 0 && <span className="hp-temp">+{hp.temp} temp</span>}
        <span className="hp-readout-stepper">
          <Stepper value={hp.current} max={hp.max || undefined} onChange={setCurrentHp} label={t("vitals.hp")} />
        </span>
      </div>
      <div className="hp-bar" aria-hidden>
        <div className="hp-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="hp-actions">
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (damagePressed.current) {
              damagePressed.current = false;
              return;
            }
            damage(1);
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
          {t("vitals.damage")}
        </button>
        <button
          type="button"
          className="btn btn-heal"
          onClick={() => {
            if (healPressed.current) {
              healPressed.current = false;
              return;
            }
            heal(1);
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
          {t("vitals.heal")}
        </button>
      </div>
      <div className="hp-fine">
        <label>
          {t("vitals.temp")}{" "}
          <Stepper value={hp.temp} onChange={setTempHp} label={t("vitals.temp")} />
        </label>
        {maxHd > 0 && (
          <label>
            {t("vitals.hitDice")}{" "}
            <Stepper
              value={hp.hitDiceRemaining}
              max={maxHd}
              showMax
              onChange={(next) => adjustHitDice(next - hp.hitDiceRemaining)}
              label={t("vitals.hitDice")}
            />
          </label>
        )}
      </div>
    </div>
  );
}

/** Edit form for the combat inputs (HP pools, AC, speed, overrides). The derived
 *  AC/initiative still show in the stat row above, recomputing as you type. */
function CombatEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const hp = c.combat.hp;
  return (
    <div className="edit-grid">
      <Field label={t("vitals.hpMax")}>
        <NumberInput value={hp.max} min={0} label={t("vitals.hpMax")} onChange={(v) => editField(["combat", "hp", "max"], v)} />
      </Field>
      <Field label={t("vitals.hpCurrent")}>
        <NumberInput value={hp.current} label={t("vitals.hpCurrent")} onChange={(v) => editField(["combat", "hp", "current"], v)} />
      </Field>
      <Field label={t("vitals.temp")}>
        <NumberInput value={hp.temp} min={0} label={t("vitals.temp")} onChange={(v) => editField(["combat", "hp", "temp"], v)} />
      </Field>
      <Field label={t("vitals.hitDice")}>
        <NumberInput
          value={hp.hitDiceRemaining}
          min={0}
          label={t("vitals.hitDice")}
          onChange={(v) => editField(["combat", "hp", "hitDiceRemaining"], v)}
        />
      </Field>
      <Field label={t("vitals.acValue")}>
        <NumberInput value={c.combat.armorClass} label={t("vitals.acValue")} onChange={(v) => editField(["combat", "armorClass"], v)} />
      </Field>
      <Field label={t("vitals.speed")}>
        <NumberInput value={c.combat.speed.walk} min={0} label={t("vitals.speed")} onChange={(v) => editField(["combat", "speed", "walk"], v)} />
      </Field>
      <OptionalNumber
        value={c.combat.armorClassOverride}
        label={t("vitals.acOverride")}
        onChange={(v) => editField(["combat", "armorClassOverride"], v)}
      />
      <OptionalNumber
        value={c.combat.initiativeOverride}
        label={t("vitals.initiativeOverride")}
        onChange={(v) => editField(["combat", "initiativeOverride"], v)}
      />
    </div>
  );
}

export function CombatSection({ c }: { c: Character }) {
  const t = useT();
  const units = useSettings((s) => s.units);
  const editMode = useCharacter((s) => s.editMode);
  const initiative = c.combat.initiativeOverride ?? abilityModifierFor(c, "dex");
  const ac = derivedArmorClass(c);

  return (
    <Panel plain title={t("vitals.title")} id="combat">
      <div className="stat-row">
        <Stat label={t("vitals.ac")} value={ac.value} note={ac.breakdown || undefined} />
        <Stat label={t("vitals.initiative")} value={fmtMod(initiative)} />
        <Stat label={t("vitals.speed")} value={formatDistance(c.combat.speed.walk, units)} />
      </div>

      {editMode ? <CombatEdit c={c} /> : <HpControl c={c} />}
    </Panel>
  );
}
