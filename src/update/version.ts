/**
 * Tiny semver-ish comparison for the update check. We only ship `major.minor.patch` tags
 * (optionally `v`-prefixed), so a full semver parser would be overkill — this compares the three
 * numeric components and ignores any pre-release/build suffix.
 */

/** Parse "v1.6.0" / "1.6.0" / "1.6.0-beta" → [1, 6, 0]. Non-numeric parts become 0. */
export function parseVersion(v: string): [number, number, number] {
  const core = v.trim().replace(/^v/i, "").split(/[-+]/, 1)[0];
  const parts = core.split(".").map((n) => Number.parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** True when `candidate` is a strictly higher version than `current`. */
export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}
