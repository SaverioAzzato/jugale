import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(async (
    _command: string,
    _args: { payload: { variants: Array<{ file: { name: string; contents: string } }> } },
  ) => undefined),
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
  it("shows a character-supplied guide name without reinterpreting it", () => {
    useCharacter.getState().loadRaw({ meta: { name: "Legacy", ruleset: ["SRD"] } });
    render(<PromptsPage />);

    expect(screen.getByLabelText("Guide name (e.g. SRD 5.1)")).toHaveValue("SRD");
  });

  it("introduces the workflow and identifies Base as the shared foundation", () => {
    render(<PromptsPage />);

    expect(screen.getByText(/ready-made prompts with the chatbot you trust/i)).toBeInTheDocument();
    expect(screen.getByText(/will return either a character\.json file or JSON content/i)).toBeInTheDocument();
    expect(screen.getByText(/Use Edit if you want to customise/i).tagName).toBe("P");
    expect(screen.getByText("Foundation used by all the other prompts")).toBeInTheDocument();
  });

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

  it("shares level-up immediately with JSON primary and text fallback", async () => {
    useCharacter.getState().loadRaw({ meta: { name: "Astrid" } });
    render(<PromptsPage />);

    expect(screen.getByText(/quickly send the prompt, schema and character/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Share" })[2]);

    await waitFor(() => expect(invoke).toHaveBeenCalledOnce());
    const [, args] = invoke.mock.calls[0];
    expect(args.payload.variants.map(({ file }: { file: { name: string } }) => file.name)).toEqual([
      "jugale-request.json",
      "prompt.txt",
    ]);
    expect(args.payload.variants[0].file.contents).toContain('"character.json"');
    expect(args.payload.variants[0].file.contents).toContain('"name": "Astrid"');
  });
});
