import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DicePalette } from "./DicePalette";
import { handleTransientBack } from "./uiBack";
import { useSettings } from "./useSettings";

describe("DicePalette", () => {
  beforeEach(() => useSettings.getState().setUiScale(100));

  it("anchors its fixed menu correctly under interface scaling", () => {
    useSettings.getState().setUiScale(120);
    render(<DicePalette />);
    const toggle = screen.getByRole("button", { name: "Roll a die" });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 412 });
    Object.defineProperty(toggle, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ bottom: 60, right: 300 }),
    });

    fireEvent.pointerDown(toggle, { button: 0, clientX: 280, clientY: 40 });

    const menu = screen.getByRole("menu");
    expect(menu.style.top).toBe("58px");
    expect(Number.parseFloat(menu.style.right)).toBeCloseTo(93.333, 3);
  });

  it("closes before navigating when UI Back is requested", () => {
    render(<DicePalette />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Roll a die" }), { button: 0 });
    expect(screen.getByRole("menu")).toBeInTheDocument();

    act(() => expect(handleTransientBack()).toBe(true));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
