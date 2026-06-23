import type { Character, Item } from "../schema";
import { Panel, WikiLink } from "./primitives";
import { Stepper } from "./controls";
import { useCharacter } from "../state/store";
import { useT, type StringKey, type TFn } from "../i18n/useI18n";

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
  if (it.ac.base != null) parts.push(`${it.ac.label || "CA"} ${it.ac.base}${it.ac.addDex ? " +Des" : ""}`);
  if (it.ac.bonus) parts.push(`${it.ac.label || ""} ${it.ac.bonus >= 0 ? "+" : ""}${it.ac.bonus}`.trim());
  return parts.join(" · ") || null;
}

function ItemRow({ entry, t }: { entry: Indexed; t: TFn }) {
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
            {[ac, it.notes, it.weight > 0 ? `${it.weight} lb` : ""].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <Stepper
        value={it.quantity}
        min={0}
        label={`${it.name}`}
        onChange={(next) => setItemQuantity(index, next)}
      />
      <button
        type="button"
        className={it.equipped ? "btn inv-equip is-on" : "btn inv-equip"}
        onClick={() => toggleEquipped(index)}
      >
        {it.equipped ? t("inv.unequip") : t("inv.equip")}
      </button>
    </li>
  );
}

function categoryLabel(cat: string, t: TFn): string {
  const key = CATEGORY_KEY[cat.toLowerCase()];
  if (key) return t(key);
  return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : t("cat.other");
}

export function InventorySection({ c }: { c: Character }) {
  const t = useT();
  const setCurrency = useCharacter((s) => s.setCurrency);

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

  return (
    <Panel title={t("inv.title")} id="inventory">
      {(attunedCount > 0 || hasWeights) && (
        <div className="inv-summary">
          {attunedCount > 0 && (
            <span className="inv-summary-stat">
              {t("inv.attunement")} {attunedCount}/3
            </span>
          )}
          {hasWeights && (
            <span className="inv-summary-stat">
              {t("inv.weight")} {Math.round(totalWeight * 10) / 10} / {capacity} lb
            </span>
          )}
        </div>
      )}

      {equipped.length > 0 && (
        <div className="inv-group inv-group-equipped">
          <h3 className="inv-group-title">{t("inv.equipped")}</h3>
          <ul className="inv-list">
            {equipped.map((e) => (
              <ItemRow key={e.it.id || e.index} entry={e} t={t} />
            ))}
          </ul>
        </div>
      )}

      {orderedCats.map((cat) => (
        <div className="inv-group" key={cat}>
          <h3 className="inv-group-title">{categoryLabel(cat, t)}</h3>
          <ul className="inv-list">
            {groups.get(cat)!.map((e) => (
              <ItemRow key={e.it.id || e.index} entry={e} t={t} />
            ))}
          </ul>
        </div>
      ))}

      {currencyCodes.length > 0 && (
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
      )}
    </Panel>
  );
}
