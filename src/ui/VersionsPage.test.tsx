import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VersionsPage } from "./VersionsPage";
import { useCharacter } from "../characterStore";
import { useI18n } from "../i18n/useI18n";
import type { StorageProvider } from "../storage/provider";
import type { CharacterVersion } from "../storage/versions";
import multiclass from "../../characters/example-multiclass/character.json";

const saved: CharacterVersion = {
  id: "character-20260727-153012-184-checkpoint.json",
  filename: "character-20260727-153012-184-checkpoint.json",
  createdAt: "2026-07-27T13:30:12.184Z",
  reason: "checkpoint",
  title: "Before the dragon",
};

describe("VersionsPage", () => {
  beforeEach(() => {
    useCharacter.getState().loadRaw(multiclass, "test");
    useI18n.getState().setLocale("en");
  });

  it("shows compact cards and restores with the requested current-version choice", async () => {
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
        delete: async () => {},
      },
    };
    useCharacter.getState().connect(provider, multiclass, "folder");
    const onRestored = vi.fn();
    render(<VersionsPage onRestored={onRestored} />);

    expect(await screen.findByText("Before the dragon")).toBeInTheDocument();
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore this version" }));
    expect(await screen.findByText("Save the current version to history?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ name: multiclass.meta.name }) }),
      "before-restore",
    );
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      document: expect.objectContaining({ meta: expect.objectContaining({ name: "Old Hero" }) }),
    }));
  });

  it("can restore without saving the current version", async () => {
    const create = vi.fn(async () => saved);
    const provider: StorageProvider = {
      kind: "file",
      read: async () => multiclass,
      write: async () => {},
      versions: { create, list: async () => [saved], read: async () => ({ meta: { name: "Old Hero" } }), delete: async () => {} },
    };
    useCharacter.getState().connect(provider, multiclass, "folder");
    const onRestored = vi.fn();
    render(<VersionsPage onRestored={onRestored} />);
    fireEvent.click(await screen.findByRole("button", { name: "Restore this version" }));
    fireEvent.click(await screen.findByRole("button", { name: "No" }));
    await waitFor(() => expect(onRestored).toHaveBeenCalled());
    expect(create).not.toHaveBeenCalled();
  });

  it("deletes a version after confirmation", async () => {
    const remove = vi.fn(async () => {});
    const provider: StorageProvider = {
      kind: "file",
      read: async () => multiclass,
      write: async () => {},
      versions: { create: async () => saved, list: async () => [saved], read: async () => multiclass, delete: remove },
    };
    useCharacter.getState().connect(provider, multiclass, "folder");
    render(<VersionsPage onRestored={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete version" }));
    fireEvent.click(screen.getByRole("dialog").querySelector(".btn-danger")!);
    await waitFor(() => expect(remove).toHaveBeenCalledWith(saved));
    expect(screen.queryByText("Before the dragon")).not.toBeInTheDocument();
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
        delete: async () => {},
      },
    };
    useCharacter.getState().connect(provider, multiclass, "folder");
    render(<VersionsPage onRestored={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Restore this version" }));
    expect(await screen.findByText(/couldn't be read/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete version" })).toBeInTheDocument();
  });
});
