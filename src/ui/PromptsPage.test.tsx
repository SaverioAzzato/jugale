import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(async (_command: string, _args: { payload: { files: Array<{ name: string; contents: string }> } }) => undefined),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../storage/androidProvider", () => ({ isAndroid: () => true }));

import { useCharacter } from "../state/store";
import { PromptsPage } from "./PromptsPage";

beforeEach(() => {
  invoke.mockClear();
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

  it("shares level-up immediately as one compatible text bundle", async () => {
    useCharacter.getState().loadRaw({ meta: { name: "Astrid" } });
    render(<PromptsPage />);

    expect(screen.getByText(/quickly send the prompt, schema and character/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Share" })[2]);

    await waitFor(() => expect(invoke).toHaveBeenCalledOnce());
    const [, args] = invoke.mock.calls[0];
    expect(args.payload.files.map((file: { name: string }) => file.name)).toEqual(["prompt.txt"]);
    expect(args.payload.files[0].contents).toContain("character.schema.json");
    expect(args.payload.files[0].contents).toContain('"name": "Astrid"');
  });
});
