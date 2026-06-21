import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";

describe("App — live editing wiring", () => {
  it("applies damage to HP through the combat control", () => {
    const { container } = render(<App />);
    const hpCurrent = () => container.querySelector(".hp-current")?.textContent;

    expect(hpCurrent()).toBe("38"); // example warlock loads by default
    fireEvent.click(screen.getByText("Danno")); // default amount 1
    expect(hpCurrent()).toBe("37");
  });
});
