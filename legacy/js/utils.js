/**
 * Utility functions for string manipulation and HTML handling
 */

export function linkify(value, href) {
  return href
    ? `<a href="${href}" target="_blank" rel="noreferrer noopener">${value}</a>`
    : value;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatIdentityItem(item) {
  if (item.parts) {
    return item.parts
      .map((part) => linkify(escapeHtml(part.value), part.link))
      .join(" / ");
  }

  return linkify(escapeHtml(item.value), item.link);
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatSlotKey(key) {
  return String(key || "slot")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function renderSimpleTable(target, headers, rows) {
  target.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  `;
}

export function getPlaceholderImage() {
  return (
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="Nessuna immagine disponibile">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#d8c0a6" />
          <stop offset="100%" stop-color="#7d2410" />
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#g)"/>
      <circle cx="400" cy="330" r="150" fill="rgba(255,255,255,0.25)" />
      <rect x="180" y="570" width="440" height="220" rx="110" fill="rgba(255,255,255,0.18)" />
      <text x="50%" y="860" fill="#fff7f0" font-family="Georgia, serif" font-size="44" text-anchor="middle">Nessuna immagine</text>
    </svg>
  `)
  );
}
