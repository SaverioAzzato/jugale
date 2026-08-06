import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppToolbar } from "./AppToolbar";
import { TOOLBAR_PRIORITY } from "./toolbarLayout";

const base = () => ({
  overlay: null,
  overlayBackRef: createRef<HTMLButtonElement>(),
  characterOpen: true,
  editMode: false,
  versionHistory: false,
  versionsAvailable: false,
  versionBusy: false,
  readOnly: false,
  liveSync: true,
  diceButtonPosition: "floating-right" as const,
  onBack: vi.fn(),
  onImport: vi.fn(),
  onExport: vi.fn(),
  onEdit: vi.fn(),
  onVersion: vi.fn(),
  onOverlay: vi.fn(),
});

describe("AppToolbar", () => {
  it("exposes the highest-priority character action and delegates it", () => {
    const props = base();
    render(<AppToolbar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit sheet" }));
    expect(props.onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders shared navigation while an overlay is active", () => {
    const props = { ...base(), overlay: "help" as const };
    render(<AppToolbar {...props} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
    expect(screen.getByRole("button", { name: "GPT prompts" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Settings" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "How to use :JUGALE" })).not.toBeInTheDocument();
  });

  it("exposes import before a character is open and gives every toolbar icon a hover hint", () => {
    const props = { ...base(), characterOpen: false };
    render(<AppToolbar {...props} />);
    const importButton = screen.getByRole("button", { name: "Import character JSON" });
    fireEvent.click(importButton);
    expect(props.onImport).toHaveBeenCalledOnce();
    for (const button of screen.getAllByRole("button")) {
      if (button.classList.contains("btn-icon")) expect(button).toHaveAttribute("title");
    }
  });

  it("keeps recovery export ahead of occasional import in the disappearance order", () => {
    expect([...TOOLBAR_PRIORITY].reverse()).toEqual([
      "settings", "help", "import", "export", "history", "version", "prompts", "raw", "edit", "dice",
    ]);
  });
});
