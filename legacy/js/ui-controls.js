/**
 * Table of Contents and UI layout management
 */

import { state, elements } from "./state.js";
import { escapeHtml } from "./utils.js";

export function isCompactTocMode() {
  return window.matchMedia("(max-width: 1080px)").matches;
}

export function syncTocUi() {
  const isVisible = elements.layout.classList.contains("is-visible");
  const compact = isCompactTocMode();
  const collapsed = state.tocCollapsed;
  const overlayVisible = state.tocOverlayOpen && isVisible;

  elements.layout.classList.toggle("toc-collapsed", compact || collapsed);

  if ((compact || collapsed) && isVisible && !overlayVisible) {
    elements.tocOpenBtn.hidden = false;
    elements.tocOpenBtn.classList.add("is-visible");
  } else {
    elements.tocOpenBtn.hidden = true;
    elements.tocOpenBtn.classList.remove("is-visible");
  }

  if (overlayVisible) {
    elements.tocSidebar.classList.add("overlay");
    elements.tocOverlayBackdrop.hidden = false;
    elements.tocOverlayBackdrop.classList.add("is-visible");
  } else {
    elements.tocSidebar.classList.remove("overlay");
    elements.tocOverlayBackdrop.classList.remove("is-visible");
    elements.tocOverlayBackdrop.hidden = true;
    state.tocOverlayOpen = false;
  }

  elements.tocDockBtn.hidden = compact;
}

export function collapseToc() {
  state.tocCollapsed = true;
  state.tocOverlayOpen = false;
  syncTocUi();
}

export function openTocOverlay() {
  if (!state.tocCollapsed && !isCompactTocMode()) {
    return;
  }
  state.tocOverlayOpen = true;
  syncTocUi();
}

export function closeTocOverlay() {
  state.tocOverlayOpen = false;
  syncTocUi();
}

export function expandTocInline() {
  state.tocCollapsed = false;
  state.tocOverlayOpen = false;
  syncTocUi();
}

export function generateTableOfContents() {
  const main = document.querySelector(".layout.is-visible main.column");
  if (!main) {
    elements.tocList.innerHTML = "";
    return;
  }

  const sections = main.querySelectorAll(
    "section.panel, section.story-card, details",
  );
  const tocItems = [];

  sections.forEach((section, index) => {
    const title = section.querySelector(".section-title, summary");
    if (!title && !section.textContent.trim()) {
      return;
    }

    let sectionId = section.id;
    if (!sectionId) {
      sectionId = `section-${index}`;
      section.id = sectionId;
    }

    const label = title?.textContent || `Sezione ${index + 1}`;
    tocItems.push({ id: sectionId, label });
  });

  elements.tocList.innerHTML = tocItems
    .map(
      (item) =>
        `<li><a href="#${item.id}" data-target="${item.id}">${escapeHtml(item.label)}</a></li>`,
    )
    .join("");

  tocItems.forEach((item) => {
    const link = elements.tocList.querySelector(`a[data-target="${item.id}"]`);
    if (!link) return;

    link.addEventListener("click", (event) => {
      event.preventDefault();
      const section = document.getElementById(item.id);
      if (!section) return;

      elements.tocList
        .querySelectorAll("a")
        .forEach((anchor) => anchor.classList.remove("active"));
      link.classList.add("active");
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      if (state.tocCollapsed) {
        closeTocOverlay();
      }
    });
  });
}
