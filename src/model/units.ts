import type { UnitSystem } from "../ui/useSettings";

/** Community-standard 5e conversion: 1 ft ≈ 0.3 m (matches the common 5ft-square -> 1.5m-square table). */
const FT_TO_M = 0.3;

export function feetToMeters(ft: number): number {
  const m = ft * FT_TO_M;
  return Math.round(m * 10) / 10;
}

function formatMeters(ft: number): string {
  const m = feetToMeters(ft);
  return `${m % 1 === 0 ? m.toFixed(0) : m} m`;
}

/** Renders a numeric distance (e.g. speed) in the active unit system. */
export function formatDistance(ft: number, units: UnitSystem): string {
  return units === "metric" ? formatMeters(ft) : `${ft} ft`;
}

/**
 * Best-effort conversion of free-text distance fields (range, area, duration…) authored
 * in feet, e.g. "100/400 ft", "15 ft cone". Only rewrites the unit when the text matches
 * a `<number> ft` pattern; anything else (e.g. "Self", "Touch") passes through unchanged.
 */
export function convertDistanceText(text: string, units: UnitSystem): string {
  if (units !== "metric" || !text) return text;
  // Slash-separated ranges sharing one unit, e.g. "100/400 ft" (short/long range).
  const withRanges = text.replace(
    /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*ft\b/gi,
    (_match, a: string, b: string) => `${feetToMeters(Number(a))}/${feetToMeters(Number(b))} m`,
  );
  return withRanges.replace(/(\d+(?:\.\d+)?)\s*ft\b/gi, (_match, num: string) => formatMeters(Number(num)));
}
