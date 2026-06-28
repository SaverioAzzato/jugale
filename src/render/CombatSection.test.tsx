import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CombatSection } from "./CombatSection";
import { loadCharacter } from "../schema";
import warlock from "../../characters/example-warlock/character.json";

const renderSection = (raw: unknown) => render(<CombatSection c={loadCharacter(raw).character} />);

describe("CombatSection", () => {
  it("shows the derived AC with its provenance breakdown, HP and speed", () => {
    renderSection(warlock);
    // AC derives from the equipped leather armor + Dex (+2), not the stored armorClass.
    expect(screen.getByText("leather 11 + dex 2")).toBeInTheDocument();
    expect(screen.getByText(/30 ft/)).toBeInTheDocument(); // walk speed
    expect(screen.getAllByText("38").length).toBeGreaterThan(0); // HP 38 / 38
  });
});
