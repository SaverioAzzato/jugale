import type { Character } from "../schema";
import { Panel, WikiLink } from "./primitives";
import { Stepper } from "./controls";
import { useCharacter } from "../state/store";

/** Item categories worth keeping in reach during combat. */
const COMBAT_CATEGORIES = new Set(["ammo", "consumable", "potion"]);

/** A filtered view onto inventory: combat-relevant items with inline ± that mutate
 *  the single source (inventory.items[].quantity). No duplication. */
export function ConsumablesSection({ c }: { c: Character }) {
  const setItemQuantity = useCharacter((s) => s.setItemQuantity);

  const entries = c.inventory.items
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => COMBAT_CATEGORIES.has(it.category.toLowerCase()));

  if (entries.length === 0) return null;

  return (
    <Panel title="Consumabili" id="consumables">
      <ul className="consumable-list">
        {entries.map(({ it, index }) => (
          <li key={it.id || index} className="consumable">
            <span className="consumable-name">
              <WikiLink link={it.link}>{it.name}</WikiLink>
            </span>
            <Stepper
              value={it.quantity}
              min={0}
              label={`quantità ${it.name}`}
              onChange={(next) => setItemQuantity(index, next)}
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
