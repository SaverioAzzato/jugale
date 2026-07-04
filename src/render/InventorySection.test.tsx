import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InventorySection } from "./InventorySection";
import { loadCharacter } from "../schema";
import warlock from "../../characters/example-warlock/character.json";

const renderSection = (raw: unknown) => render(<InventorySection c={loadCharacter(raw).character} />);

describe("InventorySection", () => {
  it("lists items and surfaces an armor item's AC contribution", () => {
    renderSection(warlock);
    expect(screen.getByText("Leather armor")).toBeInTheDocument();
    expect(screen.getByText("Dagger")).toBeInTheDocument();
    // Equipped armor shows its AC note (base + Dex), in English.
    expect(screen.getByText(/leather 11 \+Dex/)).toBeInTheDocument();
  });

  it("locks a second body armor's Equip button while one is worn (but not a shield)", () => {
    renderSection({
      meta: { name: "Armored" },
      inventory: {
        items: [
          { id: "chain", name: "Chain mail", equippable: true, equipped: true, ac: { base: 16 } },
          { id: "plate", name: "Plate", category: "armor", equippable: true, equipped: false, ac: { base: 18 } },
          { id: "shield", name: "Shield", category: "armor", equippable: true, equipped: false, ac: { bonus: 2 } },
        ],
      },
    });
    // The equipped chain mail can still be taken off.
    const chainBtn = screen.getByRole("button", { name: "Unequip" });
    expect(chainBtn).not.toBeDisabled();
    // A second body armor's Equip is disabled; a bonus-only shield's Equip is not.
    const equipButtons = screen.getAllByRole("button", { name: "Equip" });
    const plateBtn = equipButtons.find((b) => b.closest("li")?.textContent?.includes("Plate"));
    const shieldBtn = equipButtons.find((b) => b.closest("li")?.textContent?.includes("Shield"));
    expect(plateBtn).toBeDisabled();
    expect(shieldBtn).toBeEnabled();
  });
});
