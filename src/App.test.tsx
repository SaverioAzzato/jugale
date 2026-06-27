import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

  it("collapses the sample characters into a closed disclosure by default", () => {
    const { container } = render(<App />);
    const details = container.querySelector(".empty-samples-disclosure");
    expect(details).toBeInTheDocument();
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Warlock" })).toBeInTheDocument(); // present in the DOM either way
  });

  it("shows the help button only on the welcome screen, not once a character is loaded", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "How to use :JUGALE" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Warlock" }));
    expect(screen.queryByRole("button", { name: "How to use :JUGALE" })).not.toBeInTheDocument();
  });

  it("opens the Help page with how-to content and returns to the welcome screen on Back", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "How to use :JUGALE" }));
    expect(screen.getByText("What this app is")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: /Your character, always yours/i })).toBeInTheDocument();
  });

  it("turns the sheet into an editor when the pencil toggle is pressed", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Warlock" }));
    // Play mode: the name is plain text, no name input, no resource-add affordance.
    expect(screen.queryByRole("textbox", { name: "Character name" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit sheet" }));
    // Edit mode: the header name becomes an input and the Gioco tab gains the resource editor.
    expect(screen.getByRole("textbox", { name: "Character name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add resource/ })).toBeInTheDocument();
  });

  it("shows a read-only badge with an export shortcut once live sync has failed", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Warlock" }));
    expect(screen.queryByText("Read-only")).not.toBeInTheDocument();

    act(() => useCharacter.setState({ readOnly: true, saveError: "boom" }));
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export to save" })).toBeInTheDocument();
    // The gray sync status is replaced, not duplicated, by the read-only badge.
    expect(screen.queryByText("In memory")).not.toBeInTheDocument();
    expect(screen.queryByText("Unexported changes")).not.toBeInTheDocument();
  });
});
