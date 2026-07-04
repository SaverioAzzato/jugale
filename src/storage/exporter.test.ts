import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveJsonAs } from "./exporter";

// In jsdom isTauri()/isAndroid() are both false, so these exercise the web branch:
// the Chromium File System Access save picker when present, else the <a download> fallback.

type Writable = { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

function mockPicker(handleName: string): { picker: ReturnType<typeof vi.fn>; writable: Writable } {
  const writable: Writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) };
  const handle = { name: handleName, createWritable: vi.fn(async () => writable) };
  const picker = vi.fn(async () => handle);
  (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = picker;
  return { picker, writable };
}

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  vi.restoreAllMocks();
});

describe("saveJsonAs (web)", () => {
  it("writes via the save picker and reports the chosen filename (kind: name)", async () => {
    const { writable } = mockPicker("astrid.json");
    const out = await saveJsonAs({ meta: { name: "Astrid" } }, "astrid.json");
    expect(out).toEqual({ status: "saved", kind: "name", location: "astrid.json" });
    // The pretty-printed JSON is what actually gets written.
    expect(writable.write).toHaveBeenCalledWith(JSON.stringify({ meta: { name: "Astrid" } }, null, 2));
    expect(writable.close).toHaveBeenCalled();
  });

  it("falls back to a blob download when no save picker exists (kind: download)", async () => {
    // no window.showSaveFilePicker
    const out = await saveJsonAs({ meta: { name: "Astrid" } }, "astrid.json");
    expect(out).toEqual({ status: "saved", kind: "download", location: "astrid.json" });
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });

  it("returns cancelled when the user dismisses the picker (AbortError)", async () => {
    const picker = vi.fn(async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    });
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = picker;
    const out = await saveJsonAs({ meta: { name: "Astrid" } }, "astrid.json");
    expect(out).toEqual({ status: "cancelled" });
  });

  it("reports an error when the write itself fails", async () => {
    const handle = {
      name: "astrid.json",
      createWritable: vi.fn(async () => {
        throw new Error("disk full");
      }),
    };
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = vi.fn(async () => handle);
    const out = await saveJsonAs({ meta: { name: "Astrid" } }, "astrid.json");
    expect(out).toEqual({ status: "error", message: "disk full" });
  });
});
