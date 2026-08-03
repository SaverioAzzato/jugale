/** Schemes safe to turn an untrusted character.json string into a real link. */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Return a normalized absolute safe URL, or null for unsafe and relative input. */
export function safeHref(link: string): string | null {
  try {
    const url = new URL(link.trim());
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export const fmtMod = (value: number): string => (value >= 0 ? `+${value}` : `${value}`);
