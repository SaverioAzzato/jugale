import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(async (_command: string, _args: { payload: { files: Array<{ name: string }> } }) => undefined),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../storage/androidProvider", () => ({ isAndroid: () => true }));

import { useCharacter } from "../state/store";
import { PromptsPage } from "./PromptsPage";

beforeEach(() => {
  invoke.mockClear();
  localStorage.clear();
  useCharacter.getState().clear();
});

describe("PromptsPage Android sharing", () => {
  it("shows every share action and disables character-dependent prompts without a character", () => {
    render(<PromptsPage />);
    const shareButtons = screen.getAllByRole("button", { name: "Share" });

    expect(shareButtons).toHaveLength(6);
    expect(shareButtons.filter((button) => button.hasAttribute("disabled"))).toHaveLength(3);
    expect(shareButtons[0]).toBeEnabled(); // Base
    expect(shareButtons[1]).toBeEnabled(); // Create
    expect(shareButtons[2]).toBeDisabled(); // Level up
    expect(shareButtons[3]).toBeDisabled(); // Validate
    expect(shareButtons[4]).toBeEnabled(); // Custom
    expect(shareButtons[5]).toBeDisabled(); // Migrate
  });

  it("shares level-up with schema and the loaded character after the privacy notice", async () => {
    useCharacter.getState().loadRaw({ meta: { name: "Astrid" } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PromptsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Share" })[2]);

    await waitFor(() => expect(invoke).toHaveBeenCalledOnce());
    const [, args] = invoke.mock.calls[0];
    expect(args.payload.files.map((file: { name: string }) => file.name)).toEqual([
      "character.schema.json",
      "character.json",
    ]);
    expect(localStorage.getItem("jugale.android-share-notice-v1")).toBe("seen");
  });
});
