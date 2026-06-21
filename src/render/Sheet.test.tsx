import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Sheet } from "./Sheet";
import { loadCharacter } from "../schema";
import warlock from "../../characters/example-warlock/character.json";
import fighter from "../../characters/example-fighter/character.json";
import multiclass from "../../characters/example-multiclass/character.json";

const sheet = (raw: unknown, tab: string) => {
  const { character } = loadCharacter(raw);
  return render(<Sheet c={character} tab={tab} />);
};

describe("Sheet — header (always visible)", () => {
  it("shows name, class line, and derived total level", () => {
    const { container } = sheet(multiclass, "gioco");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Esempio Multiclasse");
    expect(container.querySelector(".header-stat-value")).toHaveTextContent("5"); // Paladino 3 + Stregone 2
  });
});

describe("Sheet — Gioco tab", () => {
  it("renders the derived spell save DC and keeps wiki links", () => {
    sheet(warlock, "gioco");
    expect(screen.getByText(/CD 14, attacco \+6/)).toBeInTheDocument(); // CHA 17 (+3), PB +3
    const links = screen.getAllByRole("link", { name: "Eldritch Blast" });
    expect(links[0]).toHaveAttribute("href", expect.stringContaining("dndbeyond.com"));
  });

  it("hides spells for a non-caster but still shows martial resources", () => {
    sheet(fighter, "gioco");
    expect(screen.queryByText("Incantesimi")).not.toBeInTheDocument();
    expect(screen.getAllByText("Second Wind").length).toBeGreaterThan(0);
  });
});

describe("Sheet — Scheda tab", () => {
  it("computes ability modifiers (Warlock CHA 17 → +3)", () => {
    const { container } = sheet(warlock, "scheda");
    const abilities = container.querySelector("#abilities") as HTMLElement;
    expect(within(abilities).getByText("17")).toBeInTheDocument();
    expect(within(abilities).getAllByText("+3").length).toBeGreaterThan(0);
  });
});

describe("Sheet — Storia tab", () => {
  it("renders custom sections by their layout", () => {
    sheet(multiclass, "storia");
    expect(screen.getByText("Promemoria multiclasse")).toBeInTheDocument();
  });
});
