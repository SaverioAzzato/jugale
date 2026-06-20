/**
 * Lightbox image viewer management
 */

import { state, elements } from "./state.js";
import { getImageManifest, getActivePortraitIndex } from "./image-handler.js";
import { getPlaceholderImage } from "./utils.js";

export function renderLightbox() {
  const data = state.character;
  if (!data || !state.lightboxOpen) {
    return;
  }

  const images = state.imageManifest.length
    ? state.imageManifest
    : getImageManifest(data);
  const activeIndex = getActivePortraitIndex(
    images,
    state.activeImagePath || data.meta?.portrait?.src,
  );
  const activePortrait = activeIndex >= 0 ? images[activeIndex] : null;
  const hasMultiple = images.length > 1;

  elements.lightboxImage.src =
    activePortrait?.resolvedSrc ||
    data.meta?.portrait?.src ||
    getPlaceholderImage();
  elements.lightboxImage.alt =
    activePortrait?.alt ||
    data.meta?.portrait?.alt ||
    `Ritratto di ${data.meta?.name || "personaggio"}`;
  elements.lightboxCaption.textContent = `${data.meta?.name || "Personaggio"}. ${activePortrait?.caption || data.meta?.portrait?.alt || "Scheda caricata da JSON."}`;
  elements.lightboxPrev.disabled = !hasMultiple;
  elements.lightboxNext.disabled = !hasMultiple;
}

export function openLightbox() {
  if (!state.character) {
    return;
  }

  state.lightboxOpen = true;
  elements.lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  renderLightbox();
}

export function closeLightbox() {
  state.lightboxOpen = false;
  elements.lightbox.hidden = true;
  document.body.style.overflow = "";
}

export function stepLightbox(delta) {
  if (!state.lightboxOpen) {
    return;
  }

  // Import stepPortrait dynamically to avoid circular dependencies
  import("./portrait.js").then((m) => m.stepPortrait(delta));
  renderLightbox();
}
