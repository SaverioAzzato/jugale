/**
 * Portrait carousel management
 */

import { state, elements } from "./state.js";
import {
  getImageManifest,
  getActivePortraitIndex,
  updatePortraitControls,
} from "./image-handler.js";

// Will be injected by main
let scheduleSave = null;
let renderCharacter = null;

export function initPortrait(scheduleSaveFn, renderCharacterFn) {
  scheduleSave = scheduleSaveFn;
  renderCharacter = renderCharacterFn;
}

export function setActivePortrait(image, persist = false) {
  if (!state.character) {
    return;
  }

  state.activeImagePath = image?.src || null;
  state.character.meta = state.character.meta || {};
  state.character.meta.portrait = {
    src: image?.src || state.character.meta.portrait?.src || "",
    alt:
      image?.alt ||
      state.character.meta.portrait?.alt ||
      state.character.meta.name ||
      "Ritratto del personaggio",
  };

  renderCharacter();

  if (persist) {
    scheduleSave("portrait");
  }
}

export function stepPortrait(delta) {
  const data = state.character;
  if (!data) {
    return;
  }

  const images = state.imageManifest.length
    ? state.imageManifest
    : getImageManifest(data);

  if (images.length < 2) {
    return;
  }

  const activeIndex = getActivePortraitIndex(
    images,
    state.activeImagePath || data.meta?.portrait?.src,
  );
  const nextIndex = (activeIndex + delta + images.length) % images.length;
  const nextImage = images[nextIndex];

  state.activeImagePath = nextImage.src;
  state.character.meta = state.character.meta || {};
  state.character.meta.portrait = {
    src: nextImage.src,
    alt: nextImage.alt,
  };

  scheduleSave("portrait-carousel");
  renderCharacter();
}
