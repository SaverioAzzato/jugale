/**
 * Character rendering logic
 */

import { state, elements } from "./state.js";
import {
  escapeHtml,
  formatIdentityItem,
  renderSimpleTable,
  linkify,
} from "./utils.js";
import {
  getImageManifest,
  getActivePortraitIndex,
  updatePortraitControls,
} from "./image-handler.js";
import { getPlaceholderImage } from "./utils.js";
import {
  syncFormFromData,
  buildResourceBar,
  ensureSessionResources,
} from "./session.js";
import { generateTableOfContents, syncTocUi } from "./ui-controls.js";
import { renderLightbox } from "./lightbox.js";

// Will be injected by main
let renderSessionSummary = null;

export function initRender(renderSessionSummaryFn) {
  renderSessionSummary = renderSessionSummaryFn;
}

function renderSpellTable(section) {
  return `
    <div class="table-wrap" style="margin-top: 16px;">
      <table>
        <caption style="caption-side: top; text-align: left; padding: 10px 14px 10px; font-weight: 700;">${escapeHtml(section.title)}</caption>
        <thead>
          <tr>
            <th>Incantesimo</th><th>Livello</th><th>Gittata/Area</th><th>Tiro che fai tu</th><th>Tiro avversario</th><th>Danno/Effetto</th><th>Concentrazione</th>
          </tr>
        </thead>
        <tbody>
          ${section.entries
            .map(
              (spell) => `
            <tr>
              <td>${linkify(escapeHtml(spell.name), spell.link)}${spell.notes ? `<br /><span class="muted">${escapeHtml(spell.notes)}</span>` : ""}</td>
              <td>${escapeHtml(spell.level)}</td>
              <td>${escapeHtml(spell.range)}</td>
              <td>${escapeHtml(spell.attack)}</td>
              <td>${escapeHtml(spell.defense)}</td>
              <td>${escapeHtml(spell.effect)}</td>
              <td>${escapeHtml(spell.concentration)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      ${section.summary ? `<p class="footer-note">${escapeHtml(section.summary)}</p>` : ""}
    </div>
  `;
}

export function renderInventoryTable() {
  const items = state.character?.inventory?.items || [];
  elements.inventoryTable.innerHTML = `
    <thead><tr><th>Oggetto</th><th>Quantità</th><th>Note</th></tr></thead>
    <tbody>
      ${items
        .map(
          (item, index) => `
        <tr>
          <td>${linkify(escapeHtml(item.name), item.link)}</td>
          <td><input type="number" min="0" step="1" data-inventory-qty="${index}" value="${escapeHtml(item.quantity)}" /></td>
          <td><textarea data-inventory-notes="${index}">${escapeHtml(item.notes || "")}</textarea></td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  `;

  elements.inventoryTable
    .querySelectorAll("[data-inventory-qty]")
    .forEach((input) => {
      input.addEventListener("input", (event) => {
        const index = Number(event.target.dataset.inventoryQty);
        state.character.inventory.items[index].quantity = Number(
          event.target.value || 0,
        );
        // Will trigger save through events
      });
    });

  elements.inventoryTable
    .querySelectorAll("[data-inventory-notes]")
    .forEach((input) => {
      input.addEventListener("input", (event) => {
        const index = Number(event.target.dataset.inventoryNotes);
        state.character.inventory.items[index].notes = event.target.value;
        // Will trigger save through events
      });
    });
}

export function renderCharacter() {
  const data = state.character;
  if (!data) {
    elements.setupScreen.hidden = false;
    elements.hero.classList.remove("is-visible");
    elements.layout.classList.remove("is-visible");
    state.tocOverlayOpen = false;
    syncTocUi();
    document.getElementById("reconnect-btn").style.display = "none";
    document.title = "Character Sheet Platform";
    return;
  }

  elements.setupScreen.hidden = true;
  elements.hero.classList.add("is-visible");
  elements.layout.classList.add("is-visible");
  syncTocUi();
  document.getElementById("reconnect-btn").style.display = "block";

  document.title = data.meta?.name || "Character Sheet Platform";
  elements.characterName.textContent = data.meta?.name || "Personaggio";
  elements.characterSummary.textContent =
    data.meta?.summary || data.platform?.description || "";
  const images = state.imageManifest.length
    ? state.imageManifest
    : getImageManifest(data);
  const activeIndex = getActivePortraitIndex(
    images,
    state.activeImagePath || data.meta?.portrait?.src,
  );
  const activePortrait = activeIndex >= 0 ? images[activeIndex] : null;
  if (activePortrait) {
    state.activeImagePath = activePortrait.src;
  }
  elements.portraitImage.src =
    activePortrait?.resolvedSrc ||
    data.meta?.portrait?.src ||
    getPlaceholderImage();
  elements.portraitImage.alt =
    activePortrait?.alt ||
    data.meta?.portrait?.alt ||
    `Ritratto di ${data.meta?.name || "personaggio"}`;
  elements.portraitCaption.textContent = `${data.meta?.name || "Personaggio"}. ${activePortrait?.caption || data.meta?.portrait?.alt || "Scheda caricata da JSON."}`;
  updatePortraitControls(images, activeIndex);

  if (state.lightboxOpen) {
    renderLightbox();
  }

  elements.identityGrid.innerHTML = (data.identity || [])
    .map(
      (item) => `
    <article class="identity-card">
      <span class="eyebrow">${escapeHtml(item.label)}</span>
      <strong>${formatIdentityItem(item)}</strong>
    </article>
  `,
    )
    .join("");

  elements.baseStats.innerHTML = (data.build?.baseStats || [])
    .map(
      (item) => `
    <article class="stat-card">
      <span class="eyebrow">${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
    </article>
  `,
    )
    .join("");

  elements.buildPriorities.textContent = data.build?.priorities || "";
  renderSimpleTable(
    elements.abilitiesTable,
    ["Caratteristica", "Punteggio", "Mod"],
    (data.build?.abilities || []).map((item) => [
      escapeHtml(item.name),
      escapeHtml(item.score),
      escapeHtml(item.modifier),
    ]),
  );
  renderSimpleTable(
    elements.savesTable,
    ["TS", "Bonus"],
    (data.build?.savingThrows || []).map((item) => [
      escapeHtml(item.name),
      `${escapeHtml(item.value)}${item.note ? ` (${escapeHtml(item.note)})` : ""}`,
    ]),
  );
  renderSimpleTable(
    elements.skillsTable,
    ["Abilità", "Bonus"],
    (data.build?.skills || []).map((item) => [
      escapeHtml(item.name),
      `${escapeHtml(item.value)}${item.note ? ` (${escapeHtml(item.note)})` : ""}`,
    ]),
  );
  renderSimpleTable(
    elements.attacksTable,
    [
      "Opzione",
      "Livello",
      "Gittata/Area",
      "Tiro che fai tu",
      "Tiro avversario",
      "Danno/Effetto",
      "Note",
    ],
    (data.combat?.attacks || []).map((item) => [
      linkify(escapeHtml(item.name), item.link),
      escapeHtml(item.level),
      escapeHtml(item.range),
      escapeHtml(item.attack),
      escapeHtml(item.defense),
      escapeHtml(item.effect),
      escapeHtml(item.notes || ""),
    ]),
  );
  elements.combatLevelNotes.innerHTML = (data.combat?.levelNotes || [])
    .map((note) => `<div>${escapeHtml(note)}</div>`)
    .join("");

  const spellcasting = data.combat?.spellcasting || {};
  elements.spellcastingSummary.textContent = `Riferimenti incantatore: ${spellcasting.ability || ""}, CD incantesimi ${spellcasting.saveDc || ""}, attacco incantesimi ${spellcasting.attackBonus || ""}, ${spellcasting.slots || ""}.`;
  elements.spellSections.innerHTML = (data.spellSections || [])
    .map(renderSpellTable)
    .join("");

  elements.proficienciesList.innerHTML = (data.build?.proficiencies || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.featuresList.innerHTML = (data.features?.items || [])
    .map(
      (item) =>
        `<li>${linkify(escapeHtml(item.label), item.link)}: ${escapeHtml(item.text)}</li>`,
    )
    .join("");
  elements.levelChecklist.innerHTML = (data.features?.levelChecklist || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.languagesRow.innerHTML = (data.origin?.languages || [])
    .map((item) => `<span class="pill">${escapeHtml(item)}</span>`)
    .join("");
  elements.raceNotes.innerHTML = (data.origin?.raceNotes || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.backgroundFeature.innerHTML = (data.origin?.backgroundFeature || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.roleplayList.innerHTML = (data.narrative?.roleplay || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.appearanceList.innerHTML = (data.narrative?.appearance || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.storyParagraphs.innerHTML = (data.narrative?.story || [])
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join("");
  elements.unfilledList.innerHTML = (data.narrative?.unfilled || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.notesReminders.innerHTML = (data.reminders?.notes || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.tableReminders.innerHTML = (data.reminders?.tablePlay || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  elements.inventoryNotesList.innerHTML = (data.inventory?.notes || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  renderInventoryTable();
  syncFormFromData();
  if (renderSessionSummary) renderSessionSummary();
  generateTableOfContents();
  elements.sourceData.textContent = JSON.stringify(data, null, 2);
}

export function renderSessionSummaryContent() {
  ensureSessionResources();
  const resources = state.character?.session?.resources || {};
  const currencies = state.character?.inventory?.currencies || {};
  const hpPercent = Math.max(
    0,
    Math.min(
      100,
      ((resources.currentHp || 0) / Math.max(1, resources.maxHp || 1)) * 100,
    ),
  );
  elements.hpSummary.textContent = `PF ${resources.currentHp || 0} / ${resources.maxHp || 0} | PF temporanei ${resources.tempHp || 0}`;
  elements.hpFill.style.width = `${hpPercent}%`;

  const slotBars = Object.entries(resources.slots || {}).map(([key, slot]) => {
    const total = Number(slot?.total || 0);
    const used = Number(slot?.used || 0);
    const remaining = Math.max(0, total - used);
    return buildResourceBar(
      `Slot ${key} rimasti: ${remaining}/${total}`,
      remaining,
      total,
    );
  });

  const arrowsTotal = Number(resources.arrowsTotal || resources.arrows || 0);
  const arrowsCurrent = Number(resources.arrows || 0);

  elements.sessionBars.innerHTML = [
    ...slotBars,
    buildResourceBar(
      `Frecce rimaste: ${arrowsCurrent}/${arrowsTotal}`,
      arrowsCurrent,
      arrowsTotal,
    ),
  ].join("");

  elements.sessionCoins.textContent = `Monete: ${currencies.gold || 0} mo, ${currencies.silver || 0} ma, ${currencies.copper || 0} mr.`;
}
