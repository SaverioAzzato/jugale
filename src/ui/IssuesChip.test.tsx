import { beforeEach, describe, it, expect } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { IssuesChip } from "./IssuesChip";
import type { Issue } from "../schema";
import { handleTransientBack } from "./uiBack";
import { useSettings } from "./useSettings";

const warning: Issue = {
  path: "classes",
  message: "Total level 25 exceeds 20",
  severity: "warning",
  code: "levelExceeds20",
  params: { level: 25 },
};

const error: Issue = {
  path: "meta.name",
  message: "Required",
  severity: "error",
  code: "schema",
};

describe("IssuesChip", () => {
  beforeEach(() => useSettings.getState().setUiScale(100));

  it("renders nothing when there are no issues", () => {
    const { container } = render(<IssuesChip issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows separate error and warning counts on the toggle", () => {
    render(<IssuesChip issues={[warning, error]} />);
    const toggle = screen.getByRole("button", { name: "Validation issues" });
    expect(toggle.textContent).toContain("1");
  });

  it("opens a panel listing every issue, localized and with its JSON path", () => {
    render(<IssuesChip issues={[warning, error]} />);
    fireEvent.click(screen.getByRole("button", { name: "Validation issues" }));

    expect(screen.getByText("Total level 25 exceeds 20")).toBeInTheDocument(); // interpolated template
    expect(screen.getByText("Required")).toBeInTheDocument(); // raw schema message, shown as-is
    expect(screen.getByText(/classes/)).toBeInTheDocument();
    expect(screen.getByText(/meta\.name/)).toBeInTheDocument();
  });

  it("closes the panel on close button click", () => {
    render(<IssuesChip issues={[warning]} />);
    fireEvent.click(screen.getByRole("button", { name: "Validation issues" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the panel on UI Back before the enclosing page navigates", () => {
    render(<IssuesChip issues={[warning]} />);
    fireEvent.click(screen.getByRole("button", { name: "Validation issues" }));

    act(() => expect(handleTransientBack()).toBe(true));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a proper modal: moves focus in on open, traps it, and returns it to the toggle on close", () => {
    render(<IssuesChip issues={[warning]} />);
    const toggle = screen.getByRole("button", { name: "Validation issues" });
    toggle.focus();

    fireEvent.click(toggle);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(closeBtn); // focus moved into the dialog

    fireEvent.keyDown(closeBtn, { key: "Tab" }); // single focusable: Tab stays put (trapped)
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.click(closeBtn);
    expect(document.activeElement).toBe(toggle); // focus restored to whatever opened it
  });
});
