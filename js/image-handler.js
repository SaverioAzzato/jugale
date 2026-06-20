/**
 * Image handling and manifest management
 */

import { state, elements } from "./state.js";
import { getPlaceholderImage } from "./utils.js";

export function getImageManifest(data) {
  const items = data?.assets?.images;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((image) => ({
    file: image.file || image.src || "image",
    src: image.src || "",
    alt: image.alt || image.file || "image",
    caption: image.caption || image.alt || image.file || "image",
    resolvedSrc: image.src || "",
  }));
}

export function revokeImageObjectUrls() {
  state.imageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.imageObjectUrls = [];
}

export async function prepareImageManifest(data, externalManifest = []) {
  revokeImageObjectUrls();
  const manifest = Array.isArray(externalManifest) && externalManifest.length
    ? externalManifest
    : getImageManifest(data);
  if (manifest.length === 0) {
    console.warn("No images found in images/ folder.");
  }
  state.imageManifest = manifest.map((image) => ({
    ...image,
    resolvedSrc: image.resolvedSrc || image.src,
  }));
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
