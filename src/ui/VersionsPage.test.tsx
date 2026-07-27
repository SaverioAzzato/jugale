import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VersionsPage } from "./VersionsPage";
import { useCharacter } from "../state/store";
import { useI18n } from "../i18n/useI18n";
import type { StorageProvider } from "../storage/provider";
import type { CharacterVersion } from "../storage/versions";
import multiclass from "../../characters/example-multiclass/character.json";

const saved: CharacterVersion = {
  id: "character-20260727-153012-184-checkpoint.json",
  filename: "character-20260727-153012-184-checkpoint.json",
  createdAt: "2026-07-27T13:30:12.184Z",
  reason: "checkpoint",
};

describe("VersionsPage", () => {
  beforeEach(() => {
    useCharacter.getState().loadRaw(multiclass, "test");
    useI18n.getState().setLocale("en");
  });

  it("previews and restores a version after creating a before-restore snapshot", async () => {
    const create = vi.fn(async (_data: unknown, reason: "checkpoint" | "before-import" | "before-restore") => ({
      ...saved,
      id: "character-20260727-160000-000-before-restore.json",
      filename: "character-20260727-160000-000-before-restore.json",
      reason,
    }));
    const write = vi.fn(async () => {});
    const provider: StorageProvider = {
      kind: "file",
      read: async () => multiclass,
      write,
      versions: {
        create,
        list: async () => [saved],
        read: async () => ({ schemaVersion: "2.1.0", meta: { name: "Old Hero" }, classes: [{ name: "Fighter", level: 3 }] }),
      },
    };
    useCharacter.getState().connect(provider, multiclass, "folder");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onRestored = vi.fn();
    render(<VersionsPage onRestored={onRestored} />);

    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
    expect(await screen.findByText("Old Hero")).toBeInTheDocument();
    expect(screen.getByText("Fighter 3")).toBeInTheDocument();
    expect(screen.getByText("2.1.0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore this version" }));
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(saved.filename));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ meta: expect.objectContaining({ name: multiclass.meta.name }) }), "before-restore");
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ meta: expect.objectContaining({ name: "Old Hero" }) }));
    expect(useCharacter.getState().character?.meta.name).toBe("Old Hero");
    confirm.mockRestore();
  });

  it("keeps the list usable when one historical file is unreadable", async () => {
    const provider: StorageProvider = {
      kind: "file",
      read: async () => multiclass,
      write: async () => {},
      versions: {
        create: async () => saved,
        list: async () => [saved],
        read: async () => { throw new Error("corrupt"); },
      },
    };
    useCharacter.getState().connect(provider, multiclass, "folder");
    render(<VersionsPage onRestored={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
    expect(await screen.findByText(/couldn't be read/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument();
  });
});
