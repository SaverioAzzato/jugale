import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpellsSection } from "./SpellsSection";
import { loadCharacter } from "../schema";
import warlock from "../../characters/example-warlock/character.json";
import fighter from "../../characters/example-fighter/character.json";

const renderSection = (raw: unknown) => render(<SpellsSection c={loadCharacter(raw).character} />);

describe("SpellsSection", () => {
  it("renders spell sections with their entries", () => {
    renderSection(warlock);
    expect(screen.getByText("Cantrips")).toBeInTheDocument();
    expect(screen.getByText("Eldritch Blast")).toBeInTheDocument();
    expect(screen.getByText("Hex")).toBeInTheDocument();
  });

  it("renders nothing for a non-caster", () => {
    renderSection(fighter);
    expect(screen.queryByText("Cantrips")).not.toBeInTheDocument();
  });
});
