/**
 * Session and resource management (HP, slots, inventory, currencies)
 */

import { state, elements } from "./state.js";
import { escapeHtml, toNumber, formatSlotKey } from "./utils.js";

export function ensureSessionResources() {
  state.character.session = state.character.session || {};
  state.character.session.resources = state.character.session.resources || {};

  const resources = state.character.session.resources;
  resources.currentHp = toNumber(resources.currentHp, 0);
  resources.maxHp = toNumber(resources.maxHp, 0);
  resources.tempHp = toNumber(resources.tempHp, 0);
  resources.arrows = toNumber(resources.arrows, 0);

  if (!resources.slots || typeof resources.slots !== "object") {
    resources.slots = {};
  }
  if (
    resources.slots.pact === undefined &&
    (resources.pactSlotsTotal !== undefined ||
      resources.pactSlotsUsed !== undefined)
  ) {
    resources.slots.pact = {
      total: toNumber(resources.pactSlotsTotal, 0),
      used: toNumber(resources.pactSlotsUsed, 0),
    };
  }
  if (
    resources.slots.focus === undefined &&
    (resources.focusChargesTotal !== undefined ||
      resources.focusChargesUsed !== undefined)
  ) {
    resources.slots.focus = {
      total: toNumber(resources.focusChargesTotal, 0),
      used: toNumber(resources.focusChargesUsed, 0),
    };
  }

  Object.entries(resources.slots).forEach(([key, value]) => {
    if (!value || typeof value !== "object") {
      resources.slots[key] = { total: 0, used: 0 };
      return;
    }
    resources.slots[key] = {
      total: toNumber(value.total, 0),
      used: toNumber(value.used, 0),
    };
  });

  delete resources.pactSlotsTotal;
  delete resources.pactSlotsUsed;
  delete resources.focusChargesTotal;
  delete resources.focusChargesUsed;
}

export function renderSlotFields() {
  const resources = state.character?.session?.resources || {};
  const slots = resources.slots || {};
  const slotKeys = Object.keys(slots);

  if (!slotKeys.length) {
    elements.slotFields.innerHTML =
      '<p class="footer-note">Nessuno slot definito in session.resources.slots.</p>';
    return;
  }

  elements.slotFields.innerHTML = slotKeys
    .map((key) => {
      const slot = slots[key] || { total: 0, used: 0 };
      return `
        <div class="slot-card">
          <p class="slot-card-title">${escapeHtml(formatSlotKey(key))} (${escapeHtml(key)})</p>
          <div class="slot-card-fields">
            <div class="field">
              <label for="slot-used-${escapeHtml(key)}">Usati</label>
              <input id="slot-used-${escapeHtml(key)}" type="number" min="0" step="1" data-slot-key="${escapeHtml(key)}" data-slot-field="used" value="${escapeHtml(slot.used)}" />
            </div>
            <div class="field">
              <label>Totali</label>
              <div class="pill">${escapeHtml(slot.total)}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  elements.slotFields.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      // Will be bound by events module
    });
  });
}

export function syncFormFromData() {
  ensureSessionResources();
  const resources = state.character?.session?.resources || {};
  const currencies = state.character?.inventory?.currencies || {};
  elements.currentHp.value = resources.currentHp ?? 0;
  elements.tempHp.value = resources.tempHp ?? 0;
  elements.arrows.value = resources.arrows ?? 0;
  elements.gold.value = currencies.gold ?? 0;
  elements.silver.value = currencies.silver ?? 0;
  elements.copper.value = currencies.copper ?? 0;
  elements.inventoryNotes.value =
    state.character?.session?.inventoryNotes || "";
  renderSlotFields();
}

export function updateDataFromForm() {
  ensureSessionResources();
  const resources = state.character.session.resources;
  const currencies = state.character.inventory.currencies;
  resources.currentHp = Number(elements.currentHp.value || 0);
  resources.tempHp = Number(elements.tempHp.value || 0);
  resources.arrows = Number(elements.arrows.value || 0);

  const currentSlots = resources.slots || {};
  const nextSlots = {};
  Object.keys(currentSlots).forEach((key) => {
    nextSlots[key] = {
      total: toNumber(currentSlots[key]?.total, 0),
      used: toNumber(currentSlots[key]?.used, 0),
    };
  });

  elements.slotFields
    .querySelectorAll('[data-slot-key][data-slot-field="used"]')
    .forEach((input) => {
      const key = input.dataset.slotKey;
      if (!key) {
        return;
      }
      nextSlots[key] = nextSlots[key] || { total: 0, used: 0 };
      nextSlots[key].used = Number(input.value || 0);
    });
  resources.slots = nextSlots;

  currencies.gold = Number(elements.gold.value || 0);
  currencies.silver = Number(elements.silver.value || 0);
  currencies.copper = Number(elements.copper.value || 0);
  state.character.session.inventoryNotes = elements.inventoryNotes.value;
}

export function buildResourceBar(label, current, total) {
  const safeTotal = Math.max(0, toNumber(total, 0));
  const safeCurrent = Math.max(0, toNumber(current, 0));
  const clampedCurrent =
    safeTotal > 0 ? Math.min(safeCurrent, safeTotal) : safeCurrent;
  const percent = safeTotal > 0 ? (clampedCurrent / safeTotal) * 100 : 0;

  return `
    <div class="resource-meter">
      <strong>${escapeHtml(label)}</strong>
      <div class="meter-bar" aria-hidden="true">
        <div class="meter-fill" style="width: ${Math.max(0, Math.min(100, percent))}%"></div>
      </div>
      <p style="margin: 4px 0 0; font-size: 0.88rem; color: var(--muted);">${clampedCurrent} / ${safeTotal}</p>
    </div>
  `;
}
