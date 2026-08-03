import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppToolbar } from "./AppToolbar";

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
});
