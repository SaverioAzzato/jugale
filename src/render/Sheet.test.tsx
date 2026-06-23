import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
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
  it("shows name and a compact subtitle with class and derived proficiency", () => {
    const { container } = sheet(multiclass, "gioco");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Esempio Multiclasse");
    // Paladino 3 + Stregone 2 = level 5 → PB +3; default locale en → "Prof. +3"
    expect(container.querySelector(".pb-chip")).toHaveTextContent("Prof. +3");
    expect(container.querySelector(".subtitle")).toHaveTextContent("Paladino");
  });
});

describe("Sheet — Gioco tab", () => {
  it("renders the derived spell save DC and reveals the wiki link when a spell is expanded", () => {
    sheet(warlock, "gioco");
    expect(screen.getByText(/DC 14, attack \+6/)).toBeInTheDocument(); // CHA 17 (+3), PB +3 (default locale: en)
    // Spells are collapsed rows: the wiki link lives in the expanded body.
    fireEvent.click(screen.getByRole("button", { name: /Hex/ }));
    const link = screen.getByRole("link", { name: /wiki/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("dndbeyond.com"));
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
