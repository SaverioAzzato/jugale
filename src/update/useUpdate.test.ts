import { beforeEach, describe, expect, it, vi } from "vitest";
import androidCapability from "../../src-tauri/capabilities/android.json";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { installAndroidUpdate, type AndroidReleaseAsset } from "./useUpdate";

const asset: AndroidReleaseAsset = {
  name: "JUGALE-v1.11.0-android.apk",
  browser_download_url: "https://github.com/SaverioAzzato/jugale/releases/download/v1.11.0/JUGALE.apk",
  size: 42_000_000,
  digest: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

describe("native Android updater", () => {
  beforeEach(() => invoke.mockReset());

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

  it("allows the native updater command but no longer grants frontend access to CDN hosts", () => {
    expect(androidCapability.permissions).toContain("android-updater:allow-download-and-install");
    const httpPermission = androidCapability.permissions.find(
      (permission) => typeof permission === "object" && permission.identifier === "http:default",
    );
    const allowed = typeof httpPermission === "object" && "allow" in httpPermission ? httpPermission.allow : [];
    expect(allowed).toEqual([{ url: "https://api.github.com/*" }]);
  });
});
