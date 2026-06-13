/**
 * Image handling and manifest management
 */

import { state, elements } from "./state.js";
import { getPlaceholderImage } from "./utils.js";

export function getImageManifest(data) {
  return [];
}

export async function scanImageFolder(sourceHandle) {
  if (!sourceHandle || typeof sourceHandle.getDirectoryHandle !== "function") {
    return [];
  }

  try {
    const imagesDir = await sourceHandle.getDirectoryHandle("images");
    const files = [];

    for await (const entry of imagesDir.values()) {
      if (entry.kind === "file") {
        const lower = entry.name.toLowerCase();
        if (
          lower.endsWith(".jpg") ||
          lower.endsWith(".jpeg") ||
          lower.endsWith(".png") ||
          lower.endsWith(".gif") ||
          lower.endsWith(".webp") ||
          lower.endsWith(".svg")
        ) {
          files.push(entry.name);
        }
      }
    }

    return files
      .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }))
      .map((file) => ({
        file,
        src: `images/${file}`,
        alt: file,
        caption: file,
      }));
  } catch (_) {
    return [];
  }
}

export function revokeImageObjectUrls() {
  state.imageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.imageObjectUrls = [];
}

export async function resolveImageSource(src) {
  const raw = String(src || "").trim();
  if (!raw) {
    return "";
  }

  const normalized = raw.replaceAll("\\", "/");
  const baseHandle = state.sourceHandle;

  if (!baseHandle || typeof baseHandle.getFileHandle !== "function") {
    return normalized;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length) {
    return normalized;
  }

  const findFallbackFileHandle = async (dirHandle, requestedName) => {
    const requestedLower = requestedName.toLowerCase();
    const requestedBase = requestedLower.replace(/\.[^.]+$/, "");
    const files = [];

    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file") {
        files.push(entry);
      }
    }

    const exactCaseInsensitive = files.find(
      (entry) => entry.name.toLowerCase() === requestedLower,
    );
    if (exactCaseInsensitive) {
      return exactCaseInsensitive;
    }

    const byBaseName = files.find(
      (entry) =>
        entry.name.toLowerCase().replace(/\.[^.]+$/, "") === requestedBase,
    );
    return byBaseName || null;
  };

  let currentDir = baseHandle;
  try {
    for (let i = 0; i < segments.length - 1; i += 1) {
      currentDir = await currentDir.getDirectoryHandle(segments[i]);
    }

    const requestedName = segments[segments.length - 1];
    let fileHandle;
    try {
      fileHandle = await currentDir.getFileHandle(requestedName);
    } catch (_) {
      fileHandle = await findFallbackFileHandle(currentDir, requestedName);
    }

    if (!fileHandle) {
      return normalized;
    }

    const file = await fileHandle.getFile();
    const objectUrl = URL.createObjectURL(file);
    state.imageObjectUrls.push(objectUrl);
    return objectUrl;
  } catch (_) {
    return normalized;
  }
}

export async function prepareImageManifest(data) {
  revokeImageObjectUrls();
  const manifest = await scanImageFolder(state.sourceHandle);
  if (manifest.length === 0) {
    console.warn("No images found in images/ folder.");
  }
  state.imageManifest = await Promise.all(
    manifest.map(async (image) => ({
      ...image,
      resolvedSrc: await resolveImageSource(image.src),
    })),
  );
  console.log(`Loaded ${state.imageManifest.length} images.`);
}

export function getActivePortraitIndex(images, preferredPath) {
  if (!images.length) {
    return -1;
  }

  const foundIndex = images.findIndex((image) => image.src === preferredPath);
  return foundIndex >= 0 ? foundIndex : 0;
}

export function updatePortraitControls(images, activeIndex) {
  const total = images.length;

  if (!total || activeIndex < 0) {
    elements.portraitCounter.textContent = "0/0";
    elements.portraitPrev.disabled = true;
    elements.portraitNext.disabled = true;
    return;
  }

  elements.portraitCounter.textContent = `${activeIndex + 1}/${total}`;
  const hasMultiple = total > 1;
  elements.portraitPrev.disabled = !hasMultiple;
  elements.portraitNext.disabled = !hasMultiple;
}
