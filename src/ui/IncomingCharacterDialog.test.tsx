import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18n } from "../i18n/useI18n";
import { IncomingCharacterDialog } from "./IncomingCharacterDialog";

beforeEach(() => useI18n.setState({ locale: "en" }));

describe("IncomingCharacterDialog", () => {
  it("previews validation and names the destructive target", () => {
    const apply = vi.fn();
    render(
      <IncomingCharacterDialog
        characterName="Astrid II"
        schemaVersion="2.2.0"
        issues={[{ severity: "warning", code: "hpExceedsMax", path: "combat.hp.current", message: "high" }]}
        targetName="Astrid"
        nameMismatch
        source="android-share"
        valid
        canChooseTarget
        createsNew={false}
        busy={false}
        onApply={apply}
        onChooseTarget={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("1 warnings", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Target: Astrid")).toBeInTheDocument();
    expect(screen.getByText(/images are left unchanged/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose another character" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply to Astrid" }));
    expect(apply).toHaveBeenCalledOnce();
  });

  it("requires a folder choice when no character is open", () => {
    render(
      <IncomingCharacterDialog
        characterName="Astrid"
        schemaVersion="2.2.0"
        issues={[]}
        targetName={null}
        nameMismatch={false}
        source="android-share"
        valid
        canChooseTarget
        createsNew={false}
        busy={false}
        onApply={vi.fn()}
        onChooseTarget={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Apply to/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose character folder" })).toBeInTheDocument();
  });

  it("renders the confirmation flow in Italian", () => {
    useI18n.setState({ locale: "it" });
    render(
      <IncomingCharacterDialog
        characterName="Astrid"
        schemaVersion="2.2.0"
        issues={[]}
        targetName="Astrid"
        nameMismatch={false}
        source="android-share"
        valid
        canChooseTarget
        createsNew={false}
        busy={false}
        onApply={vi.fn()}
        onChooseTarget={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Personaggio ricevuto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Applica a Astrid" })).toBeInTheDocument();
  });

  it("requires an empty character folder for a picked file when none is open", () => {
    const chooseTarget = vi.fn();
    render(
      <IncomingCharacterDialog
        characterName="Astrid"
        schemaVersion="2.2.0"
        issues={[]}
        targetName={null}
        nameMismatch={false}
        source="file-import"
        valid
        canChooseTarget
        createsNew={false}
        busy={false}
        onApply={vi.fn()}
        onChooseTarget={chooseTarget}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Import character" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose character folder" }));
    expect(chooseTarget).toHaveBeenCalledOnce();
    expect(screen.getByText(/empty folder creates a new character/i)).toBeInTheDocument();
  });

  it("names the deferred creation target", () => {
    render(
      <IncomingCharacterDialog
        characterName="Astrid"
        schemaVersion="2.2.0"
        issues={[]}
        targetName="astrid-folder"
        nameMismatch={false}
        source="file-import"
        valid
        canChooseTarget
        createsNew
        busy={false}
        onApply={vi.fn()}
        onChooseTarget={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Create in astrid-folder" })).toBeInTheDocument();
  });

  it("blocks a future-schema import even when it has no schema error rows", () => {
    render(
      <IncomingCharacterDialog
        characterName="Future"
        schemaVersion="9.0.0"
        issues={[]}
        targetName="Current"
        nameMismatch
        source="file-import"
        valid={false}
        canChooseTarget={false}
        createsNew={false}
        busy={false}
        onApply={vi.fn()}
        onChooseTarget={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Apply to Current" })).toBeDisabled();
  });
});
