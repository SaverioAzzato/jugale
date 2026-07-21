import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18n } from "../i18n/useI18n";
import { useToast } from "../ui/useToast";
import { UpdateBanner } from "./UpdateBanner";
import { useUpdate, type UpdateProgress } from "./useUpdate";

describe("UpdateBanner", () => {
  beforeEach(() => {
    useI18n.setState({ locale: "en" });
    useUpdate.setState({ state: { status: "idle" } });
    useToast.setState({ toasts: [] });
  });

  it("shows real byte progress while an Android update downloads", async () => {
    let report: ((progress: UpdateProgress) => void) | undefined;
    let finish: (() => void) | undefined;
    const apply = vi.fn((onProgress?: (progress: UpdateProgress) => void) => {
      report = onProgress;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    useUpdate.setState({
      state: { status: "available", version: "v1.11.2", kind: "download", apply },
    });
    render(<UpdateBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    act(() => report?.({ downloaded: 27, total: 100 }));

    expect(screen.getByRole("progressbar", { name: "Update download progress" })).toHaveAttribute(
      "aria-valuenow",
      "27",
    );
    expect(screen.getByText("27%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();

    await act(async () => finish?.());
  });

  it("restores the available notice and reports a failed download", async () => {
    const apply = vi.fn(async () => {
      throw new Error("network interrupted");
    });
    useUpdate.setState({
      state: { status: "available", version: "v1.11.2", kind: "download", apply },
    });
    render(<UpdateBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(await screen.findByText("A new version is available:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    expect(useToast.getState().toasts).toEqual([
      expect.objectContaining({ kind: "error", message: "Update failed", detail: "network interrupted" }),
    ]);
  });
});
