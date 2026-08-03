import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import multiclass from "../../characters/example-multiclass/character.json";
import type { StorageProvider } from "../storage/provider";
import { useCharacter } from "../characterStore";

const editor = vi.hoisted(() => ({
  options: null as null | {
    onDocChange: (text: string) => void;
    onDiagnostics: (diagnostics: unknown[]) => void;
    onToggleSearch: () => void;
  },
  destroy: vi.fn(),
}));

vi.mock("./jsonEditor", () => ({
  createJsonEditor: vi.fn((_host: HTMLElement, options: NonNullable<typeof editor.options>) => {
    editor.options = options;
    return { destroy: editor.destroy, setSearch: vi.fn() };
  }),
}));

import { RawJsonPage } from "./RawJsonPage";

const invalid = {
  ...multiclass,
  meta: { ...multiclass.meta, nestedUnknown: { keep: true } },
  resources: [{ ...multiclass.resources[0], current: "spent", unknownInArray: "keep" }],
  homebrew: { topLevel: "keep" },
};

async function mountEditor() {
  const view = render(<RawJsonPage />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(editor.options).not.toBeNull();
  return view;
}

describe("RawJsonPage — lossless commit boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    editor.options = null;
    editor.destroy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    useCharacter.getState().clear();
  });

  it("does not write a schema-invalid document while editing or when the overlay closes", async () => {
    const write = vi.fn(async (_data: unknown) => {});
    const provider: StorageProvider = { kind: "file", read: async () => multiclass, write };
    useCharacter.getState().connect(provider, multiclass, "live.json");
    const view = await mountEditor();

    act(() => editor.options?.onDocChange(JSON.stringify(invalid)));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(1_000));

    expect(write).not.toHaveBeenCalled();
    expect((useCharacter.getState() as unknown as { draft: unknown }).draft).toEqual(invalid);
  });

  it("keeps syntactically-invalid JSON only in the editor buffer", async () => {
    const write = vi.fn(async (_data: unknown) => {});
    const provider: StorageProvider = { kind: "file", read: async () => multiclass, write };
    useCharacter.getState().connect(provider, multiclass, "live.json");
    const before = useCharacter.getState().character;
    const view = await mountEditor();

    act(() => editor.options?.onDocChange('{ "meta": { "name": "unfinished" }'));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(1_000));

    expect(write).not.toHaveBeenCalled();
    expect(useCharacter.getState().character).toBe(before);
  });

  it("writes only the corrected document once, including unknown keys", async () => {
    const write = vi.fn(async (_data: unknown) => {});
    const provider: StorageProvider = { kind: "file", read: async () => multiclass, write };
    useCharacter.getState().connect(provider, multiclass, "live.json");
    const view = await mountEditor();

    act(() => editor.options?.onDocChange(JSON.stringify(invalid)));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    const corrected = {
      ...invalid,
      resources: [{ ...multiclass.resources[0], current: 1, unknownInArray: "keep" }],
    };
    act(() => editor.options?.onDocChange(JSON.stringify(corrected)));
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(1_000));

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ document: corrected }));
  });
});
