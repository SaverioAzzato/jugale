import { useState } from "react";
import type { Character, Item } from "../schema";
import { Panel, WikiLink } from "./primitives";
import { Stepper } from "./controls";
import {
  Field,
  TextInput,
  NumberInput,
  OptionalNumber,
  Toggle,
  EntryList,
  EntryRow,
  RemoveButton,
  StringListEditor,
} from "./editControls";
import { newItem, newAttackProfile } from "../model/factories";
import { useCharacter } from "../state/store";
import { useT, type StringKey, type TFn } from "../i18n/useI18n";
import { useSettings, type UnitSystem } from "../ui/useSettings";
import { formatWeight } from "../model/units";

const COIN_ORDER = ["pp", "gp", "ep", "sp", "cp"];
const COIN_KEY: Record<string, StringKey> = {
  pp: "coin.pp",
  gp: "coin.gp",
  ep: "coin.ep",
  sp: "coin.sp",
  cp: "coin.cp",
};

/** Known categories in display order; unknown ones fall after, by raw name. */
const CATEGORY_ORDER = ["weapon", "armor", "ammo", "consumable", "potion", "component", "alchemy", "tool", "gear", "treasure"];
const CATEGORY_KEY: Record<string, StringKey> = {
  weapon: "cat.weapon",
  armor: "cat.armor",
  ammo: "cat.ammo",
  consumable: "cat.consumable",
  potion: "cat.potion",
  component: "cat.component",
  alchemy: "cat.alchemy",
  tool: "cat.tool",
  gear: "cat.gear",
  treasure: "cat.treasure",
};

interface Indexed {
  it: Item;
  index: number;
}

function acNote(it: Item): string | null {
  if (!it.ac) return null;
  const parts: string[] = [];
  if (it.ac.base != null) parts.push(`${it.ac.label || "AC"} ${it.ac.base}${it.ac.addDex ? " +Dex" : ""}`);
  if (it.ac.bonus) parts.push(`${it.ac.label || ""} ${it.ac.bonus >= 0 ? "+" : ""}${it.ac.bonus}`.trim());
  return parts.join(" · ") || null;
}

function ItemRow({ entry, t, units }: { entry: Indexed; t: TFn; units: UnitSystem }) {
  const setItemQuantity = useCharacter((s) => s.setItemQuantity);
  const toggleEquipped = useCharacter((s) => s.toggleEquipped);
  const { it, index } = entry;
  const ac = acNote(it);

  return (
    <li className="inv-item">
      <div className="inv-item-main">
        <span className="inv-item-name">
          <WikiLink link={it.link}>{it.name}</WikiLink>
          {it.attuned && <span className="inv-tag">{t("inv.attuned")}</span>}
        </span>
        {(ac || it.notes || it.weight > 0) && (
          <span className="inv-item-meta">
            {[ac, it.notes, it.weight > 0 ? formatWeight(it.weight, units) : ""].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <Stepper
        value={it.quantity}
        min={0}
        label={`${it.name}`}
        onChange={(next) => setItemQuantity(index, next)}
      />
      {it.equippable && (
        <button
          type="button"
          className={it.equipped ? "btn inv-equip is-on" : "btn inv-equip"}
          onClick={() => toggleEquipped(index)}
        >
          {it.equipped ? t("inv.unequip") : t("inv.equip")}
        </button>
      )}
    </li>
  );
}

function categoryLabel(cat: string, t: TFn): string {
  const key = CATEGORY_KEY[cat.toLowerCase()];
  if (key) return t(key);
  return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : t("cat.other");
}

/** Per-item editor: core fields + optional attack profiles + optional armor AC. */
function ItemEditor({ it, index }: { it: Item; index: number }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const removeItem = useCharacter((s) => s.removeItem);
  const base = ["inventory", "items", index] as const;

  return (
    <EntryRow onRemove={() => removeItem(["inventory", "items"], index)} removeLabel={t("edit.remove")}>
      <Field label={t("item.name")}>
        <TextInput value={it.name} onChange={(v) => editField([...base, "name"], v)} label={t("item.name")} />
      </Field>
      <Field label={t("item.category")}>
        <TextInput value={it.category} onChange={(v) => editField([...base, "category"], v)} label={t("item.category")} />
      </Field>
      <Field label={t("item.quantity")}>
        <NumberInput value={it.quantity} min={0} onChange={(v) => editField([...base, "quantity"], v)} label={t("item.quantity")} />
      </Field>
      <Field label={t("inv.weight")}>
        <NumberInput value={it.weight} min={0} onChange={(v) => editField([...base, "weight"], v)} label={t("inv.weight")} />
      </Field>
      <OptionalNumber value={it.value} min={0} label={t("item.value")} onChange={(v) => editField([...base, "value"], v)} />
      <Field label={t("resource.link")}>
        <TextInput
          value={it.link ?? ""}
          onChange={(v) => editField([...base, "link"], v === "" ? null : v)}
          label={t("resource.link")}
        />
      </Field>
      <Field label={t("edit.description")}>
        <TextInput value={it.notes} multiline onChange={(v) => editField([...base, "notes"], v)} label={t("edit.description")} />
      </Field>

      <div className="edit-checks">
        <Toggle checked={it.equipped} label={t("inv.equipped")} onChange={(v) => editField([...base, "equipped"], v)} />
        <Toggle checked={it.equippable} label={t("item.equippable")} onChange={(v) => editField([...base, "equippable"], v)} />
        <Toggle checked={it.attuned} label={t("item.attuned")} onChange={(v) => editField([...base, "attuned"], v)} />
      </div>

      <details className="edit-sub">
        <summary>{t("item.attacks")}</summary>
        <EntryList onAdd={() => addItem([...base, "attacks"], newAttackProfile())} addLabel={t("item.addAttack")}>
          {it.attacks.map((p, j) => (
            <EntryRow key={j} onRemove={() => removeItem([...base, "attacks"], j)} removeLabel={t("edit.remove")}>
              <Field label={t("attack.label")}>
                <TextInput value={p.label} onChange={(v) => editField([...base, "attacks", j, "label"], v)} label={t("attack.label")} />
              </Field>
              <Field label={t("detail.range")}>
                <TextInput value={p.range} onChange={(v) => editField([...base, "attacks", j, "range"], v)} label={t("detail.range")} />
              </Field>
              <Field label={t("detail.yourRoll")}>
                <TextInput value={p.attack} onChange={(v) => editField([...base, "attacks", j, "attack"], v)} label={t("detail.yourRoll")} />
              </Field>
              <Field label={t("detail.enemyRoll")}>
                <TextInput value={p.defense} onChange={(v) => editField([...base, "attacks", j, "defense"], v)} label={t("detail.enemyRoll")} />
              </Field>
              <Field label={t("detail.damageEffect")}>
                <TextInput value={p.effect} onChange={(v) => editField([...base, "attacks", j, "effect"], v)} label={t("detail.damageEffect")} />
              </Field>
              <Field label={t("detail.notes")}>
                <TextInput value={p.notes} onChange={(v) => editField([...base, "attacks", j, "notes"], v)} label={t("detail.notes")} />
              </Field>
            </EntryRow>
          ))}
        </EntryList>
      </details>

      <details className="edit-sub">
        <summary>{t("item.acTitle")}</summary>
        <Toggle
          checked={it.ac != null}
          label={t("ac.enable")}
          onChange={(v) => editField([...base, "ac"], v ? { base: null, addDex: false, dexCap: null, bonus: 0, label: "" } : null)}
        />
        {it.ac && (
          <div className="edit-grid">
            <OptionalNumber value={it.ac.base} label={t("ac.base")} onChange={(v) => editField([...base, "ac", "base"], v)} />
            <Field label={t("ac.bonus")}>
              <NumberInput value={it.ac.bonus} onChange={(v) => editField([...base, "ac", "bonus"], v)} label={t("ac.bonus")} />
            </Field>
            <Toggle checked={it.ac.addDex} label={t("ac.addDex")} onChange={(v) => editField([...base, "ac", "addDex"], v)} />
            <OptionalNumber value={it.ac.dexCap} label={t("ac.dexCap")} onChange={(v) => editField([...base, "ac", "dexCap"], v)} />
            <Field label={t("ac.label")}>
              <TextInput value={it.ac.label} onChange={(v) => editField([...base, "ac", "label"], v)} label={t("ac.label")} />
            </Field>
          </div>
        )}
      </details>
    </EntryRow>
  );
}

/** Edit layout for the whole inventory: flat item list (array order) + currencies + notes. */
function InventoryEdit({ c }: { c: Character }) {
  const t = useT();
  const editField = useCharacter((s) => s.editField);
  const addItem = useCharacter((s) => s.addItem);
  const currencyCodes = Object.keys(c.inventory.currencies);
  const [draftCoin, setDraftCoin] = useState("");

  const addCurrency = () => {
    const code = draftCoin.trim().toLowerCase();
    if (!code || code in c.inventory.currencies) return;
    editField(["inventory", "currencies", code], 0);
    setDraftCoin("");
  };
  const removeCurrency = (code: string) => {
    const next = { ...c.inventory.currencies };
    delete next[code];
    editField(["inventory", "currencies"], next);
  };

  return (
    <>
      <Panel title={t("inv.title")} id="inventory">
        <EntryList onAdd={() => addItem(["inventory", "items"], newItem())} addLabel={t("inv.addItem")}>
          {c.inventory.items.map((it, index) => (
            <ItemEditor key={it.id || index} it={it} index={index} />
          ))}
        </EntryList>
      </Panel>

      <Panel title={t("inv.currency")}>
        <div className="edit-list">
          {currencyCodes.map((code) => (
            <div key={code} className="edit-coinrow">
              <span className="edit-coin-code">{code}</span>
              <NumberInput
                value={c.inventory.currencies[code]}
                min={0}
                label={code}
                onChange={(v) => editField(["inventory", "currencies", code], v)}
              />
              <RemoveButton onClick={() => removeCurrency(code)} label={t("edit.remove")} />
            </div>
          ))}
          <div className="edit-tag-add">
            <input
              type="text"
              className="edit-input"
              value={draftCoin}
              aria-label={t("inv.currencyCode")}
              placeholder={t("inv.currencyCode")}
              onChange={(e) => setDraftCoin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCurrency();
                }
              }}
            />
            <button type="button" className="btn edit-add" onClick={addCurrency}>
              ＋ {t("inv.addCurrency")}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title={t("inv.notesTitle")}>
        <StringListEditor
          values={c.inventory.notes}
          onChange={(next) => editField(["inventory", "notes"], next)}
          label={t("inv.notesTitle")}
          addLabel={t("inv.addNote")}
          multiline
        />
      </Panel>
    </>
  );
}

export function InventorySection({ c }: { c: Character }) {
  const t = useT();
  const units = useSettings((s) => s.units);
  const editMode = useCharacter((s) => s.editMode);
  const setCurrency = useCharacter((s) => s.setCurrency);
  if (editMode) return <InventoryEdit c={c} />;

  const indexed: Indexed[] = c.inventory.items.map((it, index) => ({ it, index }));
  const currencyCodes = [
    ...COIN_ORDER.filter((k) => k in c.inventory.currencies),
    ...Object.keys(c.inventory.currencies).filter((k) => !COIN_ORDER.includes(k)),
  ];
  if (indexed.length === 0 && currencyCodes.length === 0) return null;

  const equipped = indexed.filter((e) => e.it.equipped);
  const rest = indexed.filter((e) => !e.it.equipped);

  // Group the non-equipped items by category, ordered.
  const groups = new Map<string, Indexed[]>();
  for (const e of rest) {
    const cat = (e.it.category || "other").toLowerCase();
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(e);
  }
  const orderedCats = [...groups.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  // Attunement (max 3) and optional encumbrance (only if any item declares weight).
  const attunedCount = indexed.filter((e) => e.it.attuned).length;
  const totalWeight = indexed.reduce((sum, e) => sum + (e.it.weight || 0) * (e.it.quantity || 0), 0);
  const hasWeights = indexed.some((e) => e.it.weight > 0);
  const capacity = c.abilities.str.score * 15;
  const encumbered = hasWeights && totalWeight > capacity;

  return (
    <>
      {/* Carry-state summary (attunement + optional encumbrance), no card chrome of its own. */}
      {(attunedCount > 0 || hasWeights) && (
        <div className="inv-meta">
          {attunedCount > 0 && (
            <div className="inv-summary">
              <span className="inv-summary-stat">
                {t("inv.attunement")} {attunedCount}/3
              </span>
            </div>
          )}
          {hasWeights && (
            <div className={encumbered ? "inv-encumbrance is-over" : "inv-encumbrance"}>
              <div className="inv-encumbrance-label">
                <span>{t("inv.weight")}</span>
                <span>
                  {formatWeight(Math.round(totalWeight * 10) / 10, units)} / {formatWeight(capacity, units)}
                </span>
              </div>
              <div className="inv-encumbrance-bar">
                <div
                  className="inv-encumbrance-fill"
                  style={{ width: `${Math.min(100, (totalWeight / capacity) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Equipped is its own, chrome-less card so it reads as the primary inventory section. */}
      {equipped.length > 0 && (
        <Panel plain title={t("inv.equipped")} id="inventory">
          <ul className="inv-list">
            {equipped.map((e) => (
              <ItemRow key={e.it.id || e.index} entry={e} t={t} units={units} />
            ))}
          </ul>
        </Panel>
      )}

      {/* Each item category becomes its own titled card. */}
      {orderedCats.map((cat) => (
        <Panel key={cat} title={categoryLabel(cat, t)}>
          <ul className="inv-list">
            {groups.get(cat)!.map((e) => (
              <ItemRow key={e.it.id || e.index} entry={e} t={t} units={units} />
            ))}
          </ul>
        </Panel>
      ))}

      {currencyCodes.length > 0 && (
        <Panel title={t("inv.currency")}>
          <div className="currencies">
            {currencyCodes.map((code) => (
              <div key={code} className="currency">
                <span>{COIN_KEY[code] ? t(COIN_KEY[code]) : code}</span>
                <Stepper
                  value={c.inventory.currencies[code]}
                  label={code}
                  onChange={(next) => setCurrency(code, next)}
                />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
