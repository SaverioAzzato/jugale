import type { Character } from "../schema";
import { Panel, DataTable, WikiLink } from "./primitives";

const COIN: Record<string, string> = { pp: "mp", gp: "mo", ep: "me", sp: "ma", cp: "mr" };

export function InventorySection({ c }: { c: Character }) {
  const items = c.inventory.items;
  const coins = Object.entries(c.inventory.currencies).filter(([, v]) => v);
  if (items.length === 0 && coins.length === 0) return null;

  return (
    <Panel title="Inventario" id="inventory">
      {items.length > 0 && (
        <DataTable
          headers={["Oggetto", "Qtà", "Note"]}
          rows={items.map((it) => [
            <span>
              <WikiLink link={it.link}>{it.name}</WikiLink>
              {it.equipped ? <small className="muted"> (equipaggiato)</small> : null}
            </span>,
            it.quantity,
            it.notes,
          ])}
        />
      )}
      {coins.length > 0 && (
        <p className="coins">{coins.map(([k, v]) => `${v} ${COIN[k] ?? k}`).join(" · ")}</p>
      )}
    </Panel>
  );
}
