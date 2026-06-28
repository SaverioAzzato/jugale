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
});
