import { beforeEach, describe, expect, it, vi } from "vitest";
import androidCapability from "../../src-tauri/capabilities/android.json";
import defaultPermissions from "../../src-tauri/plugins/android-updater/permissions/default.toml?raw";
import listenerPermissions from "../../src-tauri/plugins/android-updater/permissions/listeners.toml?raw";

const invoke = vi.fn();
const unregister = vi.fn();
const addPluginListener = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke, addPluginListener }));

import { installAndroidUpdate, type AndroidReleaseAsset } from "./useUpdate";

const asset: AndroidReleaseAsset = {
  name: "JUGALE-v1.11.0-android.apk",
  browser_download_url: "https://github.com/SaverioAzzato/jugale/releases/download/v1.11.0/JUGALE.apk",
  size: 42_000_000,
  digest: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

describe("native Android updater", () => {
  beforeEach(() => {
    invoke.mockReset();
    unregister.mockReset();
    addPluginListener.mockReset();
    addPluginListener.mockResolvedValue({ unregister });
  });

  it("hands trusted GitHub metadata to the native verified downloader", async () => {
    invoke.mockResolvedValue(undefined);

    await installAndroidUpdate(asset);

    expect(invoke).toHaveBeenCalledWith("plugin:android-updater|download_and_install", {
      payload: {
        url: asset.browser_download_url,
        fileName: asset.name,
        expectedSize: asset.size,
        expectedDigest: asset.digest,
      },
    });
  });

  it("forwards native byte progress and removes the listener after the installer opens", async () => {
    const onProgress = vi.fn();
    invoke.mockImplementation(async () => {
      const listener = addPluginListener.mock.calls[0][2] as (progress: { downloaded: number; total: number }) => void;
      listener({ downloaded: 21_000_000, total: asset.size });
    });

    await installAndroidUpdate(asset, onProgress);

    expect(addPluginListener).toHaveBeenCalledWith("android-updater", "download-progress", expect.any(Function));
    expect(onProgress).toHaveBeenNthCalledWith(1, { downloaded: 0, total: asset.size });
    expect(onProgress).toHaveBeenNthCalledWith(2, { downloaded: 21_000_000, total: asset.size });
    expect(unregister).toHaveBeenCalledOnce();
  });

  it("allows the native updater workflow, including progress listeners, but no CDN hosts", () => {
    expect(androidCapability.permissions).toContain("android-updater:default");

    expect(defaultPermissions).toContain('"allow-download-and-install"');
    expect(defaultPermissions).toContain('"allow-listeners"');

    expect(listenerPermissions).toContain('"registerListener"');
    expect(listenerPermissions).toContain('"remove_listener"');

    const httpPermission = androidCapability.permissions.find(
      (permission) => typeof permission === "object" && permission.identifier === "http:default",
    );
    const allowed = typeof httpPermission === "object" && "allow" in httpPermission ? httpPermission.allow : [];
    expect(allowed).toEqual([{ url: "https://api.github.com/*" }]);
  });
});
