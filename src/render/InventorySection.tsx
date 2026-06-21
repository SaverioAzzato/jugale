import type { Character } from "../schema";
import { Panel, DataTable, WikiLink } from "./primitives";
import { Stepper } from "./controls";
import { useCharacter } from "../state/store";

const COIN: Record<string, string> = { pp: "mp", gp: "mo", ep: "me", sp: "ma", cp: "mr" };
const COIN_ORDER = ["pp", "gp", "ep", "sp", "cp"];

export function InventorySection({ c }: { c: Character }) {
  const setItemQuantity = useCharacter((s) => s.setItemQuantity);
  const setCurrency = useCharacter((s) => s.setCurrency);

  const items = c.inventory.items;
  const currencyCodes = [
    ...COIN_ORDER.filter((k) => k in c.inventory.currencies),
    ...Object.keys(c.inventory.currencies).filter((k) => !COIN_ORDER.includes(k)),
  ];
  if (items.length === 0 && currencyCodes.length === 0) return null;

  return (
    <Panel title="Inventario" id="inventory">
      {items.length > 0 && (
        <DataTable
          headers={["Oggetto", "Qtà", "Note"]}
          rows={items.map((it, i) => [
            <span>
              <WikiLink link={it.link}>{it.name}</WikiLink>
              {it.equipped ? <small className="muted"> (equipaggiato)</small> : null}
            </span>,
            <Stepper value={it.quantity} label={`quantità ${it.name}`} onChange={(next) => setItemQuantity(i, next)} />,
            it.notes,
          ])}
        />
      )}
      {currencyCodes.length > 0 && (
        <div className="currencies">
          {currencyCodes.map((code) => (
            <label key={code} className="currency">
              <span>{COIN[code] ?? code}</span>
              <input
                type="number"
                min={0}
                value={c.inventory.currencies[code]}
                onChange={(e) => setCurrency(code, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      )}
    </Panel>
  );
}
