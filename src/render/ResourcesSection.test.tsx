import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResourcesSection } from "./ResourcesSection";
import { loadCharacter } from "../schema";
import warlock from "../../characters/example-warlock/character.json";
import fighter from "../../characters/example-fighter/character.json";

const renderSection = (raw: unknown) => render(<ResourcesSection c={loadCharacter(raw).character} />);

describe("ResourcesSection", () => {
  it("renders a spell-slot resource (pact magic)", () => {
    renderSection(warlock);
    expect(screen.getByText("Pact Slots")).toBeInTheDocument();
  });

  it("renders martial charges for a non-caster", () => {
    renderSection(fighter);
    expect(screen.getByText("Second Wind")).toBeInTheDocument();
    expect(screen.getByText("Action Surge")).toBeInTheDocument();
  });
});
