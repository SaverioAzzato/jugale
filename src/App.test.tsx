import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { App } from "./App";
import { useCharacter } from "./state/store";
import { useSettings } from "./ui/useSettings";

const androidBack = vi.hoisted(() => ({
  enabled: false,
  handler: null as null | (() => void),
  unregister: vi.fn(),
  register: vi.fn(),
}));

vi.mock("./storage/androidProvider", async () => {
  const actual = await vi.importActual<typeof import("./storage/androidProvider")>("./storage/androidProvider");
  return { ...actual, isAndroid: () => androidBack.enabled };
});

vi.mock("@tauri-apps/api/app", () => ({ onBackButtonPress: androidBack.register }));

describe("App — empty state + live editing wiring", () => {
  beforeEach(() => {
    useCharacter.setState({ character: null, liveSync: false, dirty: false });
    useSettings.getState().setUiScale(100);
    androidBack.enabled = false;
    androidBack.handler = null;
    androidBack.unregister.mockReset();
    androidBack.register.mockReset();
    androidBack.register.mockImplementation(async (handler: () => void) => {
      androidBack.handler = handler;
      return { unregister: androidBack.unregister };
    });
  });

  it("maps Android system Back to the visible Back action on an app page", async () => {
    androidBack.enabled = true;
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    await waitFor(() => expect(androidBack.handler).not.toBeNull());

    act(() => androidBack.handler?.());

    expect(screen.getByRole("heading", { name: /Your character, always yours/i })).toBeInTheDocument();
  });

  it("asks before Android system Back closes an unsaved character", async () => {
    androidBack.enabled = true;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Warlock" }));
    act(() => useCharacter.setState({ dirty: true }));
    await waitFor(() => expect(androidBack.register.mock.calls.length).toBeGreaterThanOrEqual(2));

    act(() => androidBack.handler?.());
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Example Warlock");

    confirm.mockReturnValue(true);
    act(() => androidBack.handler?.());
    expect(screen.getByRole("heading", { name: /Your character, always yours/i })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("starts on the welcome screen and loads a sample on demand", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Your character, always yours/i })).toBeInTheDocument(); // default locale: en

    fireEvent.click(screen.getByRole("button", { name: "Warlock" })); // empty-state sample chip
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Example Warlock");
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
    // "What this app is" now appears both as a section heading and a TOC link — scope to the heading.
    expect(screen.getByRole("heading", { name: "What this app is" })).toBeInTheDocument();

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

  it("animates a swiped tab in from the gesture direction, but not a clicked tab", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Warlock" }));

    const sheet = container.querySelector(".sheet-swipe");
    expect(sheet).toBeInTheDocument();
    fireEvent.touchStart(sheet!, { touches: [{ clientX: 240, clientY: 120 }] });
    fireEvent.touchEnd(sheet!, { changedTouches: [{ clientX: 100, clientY: 125 }] });

    expect(screen.getByRole("tab", { name: "Attributes" })).toHaveAttribute("aria-selected", "true");
    expect(container.querySelector(".sheet-swipe")).toHaveClass("sheet-swipe-from-right");

    fireEvent.click(screen.getByRole("tab", { name: "Play" }));
    expect(container.querySelector(".sheet-swipe")).toHaveClass("sheet-swipe");
    expect(container.querySelector(".sheet-swipe")).not.toHaveClass("sheet-swipe-from-left");
    expect(container.querySelector(".sheet-swipe")).not.toHaveClass("sheet-swipe-from-right");
  });

  it("scrolls an overflowing tab row just enough to reveal the selected tab", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Warlock" }));
    const tabbar = container.querySelector<HTMLElement>(".tabbar")!;
    const story = screen.getByRole("tab", { name: "Story" });
    const scrollTo = vi.fn();
    Object.defineProperties(tabbar, {
      clientWidth: { configurable: true, value: 150 },
      scrollLeft: { configurable: true, writable: true, value: 0 },
      scrollTo: { configurable: true, value: scrollTo },
    });
    Object.defineProperties(story, {
      offsetLeft: { configurable: true, value: 240 },
      offsetWidth: { configurable: true, value: 70 },
    });

    fireEvent.click(story);

    expect(scrollTo).toHaveBeenCalledWith({ left: 168, behavior: "smooth" });
  });

  it("moves low-priority toolbar actions into More when scaled controls no longer fit", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Warlock" }));
    const toolbar = container.querySelector<HTMLElement>(".toolbar")!;
    const left = container.querySelector<HTMLDivElement>(".toolbar-left")!;
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue({ width: 390 } as DOMRect);
    vi.spyOn(left, "getBoundingClientRect").mockReturnValue({ width: 40.8 } as DOMRect);

    act(() => useSettings.getState().setUiScale(120));

    expect(screen.getByRole("button", { name: "Roll a die" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit sheet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Raw JSON editor" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "GPT prompts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("•••"));
    expect(screen.getByRole("menuitem", { name: "GPT prompts" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
  });

  it("locks page scrolling while the raw JSON editor owns the viewport", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Warlock" }));
    fireEvent.click(screen.getByRole("button", { name: "Raw JSON editor" }));

    expect(container.querySelector(".app")).toHaveClass("app-rawjson");
    expect(container.querySelector(".rawjson-page")).toBeInTheDocument();
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
