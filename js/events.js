/**
 * Event binding and handlers
 */

import { state, elements } from "./state.js";
import {
  connectJson,
  openRecentCharacter,
  reconnectJson,
  exportCopy,
  scheduleSave,
} from "./character-data.js";
import { stepPortrait } from "./portrait.js";
import { openLightbox, closeLightbox, stepLightbox } from "./lightbox.js";
import {
  collapseToc,
  expandTocInline,
  openTocOverlay,
  closeTocOverlay,
} from "./ui-controls.js";
import { updateDataFromForm } from "./session.js";

export function bindEvents() {
  // Connection buttons
  document.getElementById("connect-btn").addEventListener("click", async () => {
    try {
      await connectJson();
    } catch (error) {
      console.error(error);
    }
  });

  if (elements.setupRecentList) {
    elements.setupRecentList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-recent-index]");
      if (!button) {
        return;
      }

      const index = Number(button.dataset.recentIndex);
      if (Number.isNaN(index)) {
        return;
      }

      try {
        await openRecentCharacter(index);
      } catch (error) {
        console.error(error);
      }
    });
  }

  document
    .getElementById("reconnect-btn")
    .addEventListener("click", reconnectJson);

  document.getElementById("export-btn").addEventListener("click", exportCopy);

  // Portrait controls
  elements.portraitPrev.addEventListener("click", () => stepPortrait(-1));
  elements.portraitNext.addEventListener("click", () => stepPortrait(1));
  elements.portraitImage.addEventListener("click", openLightbox);

  // TOC controls
  elements.tocCloseBtn.addEventListener("click", () => {
    if (state.tocOverlayOpen) {
      closeTocOverlay();
    } else {
      collapseToc();
    }
  });
  elements.tocDockBtn.addEventListener("click", expandTocInline);
  elements.tocOpenBtn.addEventListener("click", openTocOverlay);
  elements.tocOverlayBackdrop.addEventListener("click", closeTocOverlay);

  // Lightbox controls
  elements.lightboxPrev.addEventListener("click", () => stepLightbox(-1));
  elements.lightboxNext.addEventListener("click", () => stepLightbox(1));
  elements.lightboxClose.addEventListener("click", closeLightbox);
  elements.lightbox.addEventListener("click", (event) => {
    if (event.target === elements.lightbox) {
      closeLightbox();
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.lightboxOpen) {
        closeLightbox();
        return;
      }

      if (state.tocOverlayOpen) {
        closeTocOverlay();
      }
      return;
    }

    if (event.key.toLowerCase() === "t") {
      if (state.tocCollapsed) {
        if (state.tocOverlayOpen) {
          closeTocOverlay();
        } else {
          openTocOverlay();
        }
      } else {
        collapseToc();
      }
      return;
    }

    if (!state.lightboxOpen) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepLightbox(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepLightbox(1);
    }
  });

  // Session resource inputs
  [
    elements.currentHp,
    elements.tempHp,
    elements.arrows,
    elements.gold,
    elements.silver,
    elements.copper,
    elements.inventoryNotes,
  ].forEach((input) =>
    input.addEventListener("input", () => scheduleSave("session")),
  );

  // Inventory and slots
  document.addEventListener("change", (event) => {
    if (
      event.target.matches("[data-inventory-qty]") ||
      event.target.matches("[data-inventory-notes]") ||
      event.target.matches('[data-slot-key][data-slot-field="used"]')
    ) {
      scheduleSave("inventory-or-slots");
    }
  });

  // Window resize for TOC responsiveness
  window.addEventListener("resize", () => {
    import("./ui-controls.js").then((m) => m.syncTocUi());
  });
}

// Export global API
export function setupGlobalAPI() {
  window.characterPlatform = {
    async loadCharacterData(data) {
      const { loadCharacterData: loadCharFn } =
        await import("./character-data.js");
      await loadCharFn(JSON.parse(JSON.stringify(data)), {
        liveSync: false,
      });
    },
    getCharacterData() {
      return JSON.parse(JSON.stringify(state.character));
    },
  };
}
