import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  android: false,
  tauri: false,
  androidPick: vi.fn(),
  tauriPick: vi.fn(),
  webPick: vi.fn(),
}));

vi.mock("./androidProvider", () => ({
  isAndroid: () => mocks.android,
  pickCharacterImportTargetAndroid: mocks.androidPick,
}));
vi.mock("./tauriProvider", () => ({
  isTauri: () => mocks.tauri,
  pickCharacterImportTargetTauri: mocks.tauriPick,
}));
vi.mock("./provider", () => ({ pickCharacterImportTargetWeb: mocks.webPick }));

import { pickCharacterImportTarget } from "./characterImport";

describe("pickCharacterImportTarget", () => {
  beforeEach(() => {
    mocks.android = false;
    mocks.tauri = false;
    vi.clearAllMocks();
  });

  it("uses Android folder access before desktop Tauri", async () => {
    mocks.android = true;
    mocks.androidPick.mockResolvedValue("android");
    await expect(pickCharacterImportTarget()).resolves.toBe("android");
    expect(mocks.tauriPick).not.toHaveBeenCalled();
  });

  it("uses the desktop folder picker in Tauri", async () => {
    mocks.tauri = true;
    mocks.tauriPick.mockResolvedValue("tauri");
    await expect(pickCharacterImportTarget()).resolves.toBe("tauri");
  });

  it("uses writable web folder access in the browser", async () => {
    mocks.webPick.mockResolvedValue("web");
    await expect(pickCharacterImportTarget()).resolves.toBe("web");
  });
});
