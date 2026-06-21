import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Sheet } from "./Sheet";
import { loadCharacter } from "../schema";
import warlock from "../../characters/example-warlock/character.json";
import fighter from "../../characters/example-fighter/character.json";
import multiclass from "../../characters/example-multiclass/character.json";

const sheetFor = (raw: unknown) => {
  const { character } = loadCharacter(raw);
  return render(<Sheet c={character} />);
};

describe("Sheet — data-driven rendering", () => {
  it("renders the character name and derived spell save DC", () => {
    sheetFor(warlock);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Esempio Warlock");
    // CHA 17 (+3) at level 5 (PB +3) → DC 14, attack +6
    expect(screen.getByText(/CD 14, attacco \+6/)).toBeInTheDocument();
  });

  it("preserves clickable wiki links on spells", () => {
    sheetFor(warlock);
    const links = screen.getAllByRole("link", { name: "Eldritch Blast" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", expect.stringContaining("dndbeyond.com"));
  });

  it("computes ability modifiers (Warlock CHA 17 → +3)", () => {
    const { container } = sheetFor(warlock);
    const abilities = container.querySelector("#abilities")!;
    expect(within(abilities as HTMLElement).getByText("17")).toBeInTheDocument();
    expect(within(abilities as HTMLElement).getAllByText("+3").length).toBeGreaterThan(0);
  });

  it("hides sections with no data (Fighter has no spells)", () => {
    sheetFor(fighter);
    expect(screen.queryByText("Incantesimi")).not.toBeInTheDocument();
    // but its martial resources still render (label appears in resources + features)
    expect(screen.getAllByText("Second Wind").length).toBeGreaterThan(0);
  });

  it("renders a multiclass character with total level and both casters", () => {
    const { container } = sheetFor(multiclass);
    const level = container.querySelector(".header-stat-value")!;
    expect(level).toHaveTextContent("5"); // Paladino 3 + Stregone 2
    expect(screen.getAllByText(/Paladino/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Stregone/).length).toBeGreaterThan(0);
  });

  it("renders custom sections by their layout (checklist)", () => {
    sheetFor(multiclass);
    expect(screen.getByText("Promemoria multiclasse")).toBeInTheDocument();
  });
});
