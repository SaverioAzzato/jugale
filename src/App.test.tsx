import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";
import { useCharacter } from "./state/store";

describe("App — empty state + live editing wiring", () => {
  beforeEach(() => useCharacter.setState({ character: null, liveSync: false, dirty: false }));

  it("starts on the welcome screen and loads a sample on demand", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Your character, always yours/i })).toBeInTheDocument(); // default locale: en

    fireEvent.click(screen.getByRole("button", { name: "Warlock" })); // empty-state sample chip
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Esempio Warlock");
  });

  it("applies damage to HP through the combat control", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Warlock" }));

    const hpCurrent = () => container.querySelector(".hp-current")?.textContent;
    expect(hpCurrent()).toBe("38");
    fireEvent.click(screen.getByText("Damage")); // default amount 1, en locale
    expect(hpCurrent()).toBe("37");
  });
});
