export const VERSION_REASONS = ["checkpoint", "before-import", "before-restore"] as const;

export type VersionReason = (typeof VERSION_REASONS)[number];

export interface CharacterVersion {
  id: string;
  filename: string;
  createdAt: string;
  reason: VersionReason;
}

export interface VersionStore {
  create(data: unknown, reason: VersionReason, now?: Date): Promise<CharacterVersion>;
  list(): Promise<CharacterVersion[]>;
  read(version: CharacterVersion): Promise<unknown>;
}

const VERSION_FILENAME_RE =
  /^character-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{3})-(checkpoint|before-import|before-restore)\.json$/;

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

/** Local-time, alphabetically sortable filename. The reason stays outside character.json. */
export function versionFilename(date: Date, reason: VersionReason): string {
  return [
    `character-${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}`,
    `${pad(date.getHours(), 2)}${pad(date.getMinutes(), 2)}${pad(date.getSeconds(), 2)}`,
    `${pad(date.getMilliseconds(), 3)}-${reason}.json`,
  ].join("-");
}

/** Returns null for unrelated files so a history folder may contain user-owned content safely. */
export function parseVersionFilename(filename: string): CharacterVersion | null {
  const match = VERSION_FILENAME_RE.exec(filename);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, millisecond, reason] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond),
  );
  // Reject calendar overflow such as 20260231 instead of silently normalizing it.
  if (versionFilename(date, reason as VersionReason) !== filename) return null;
  return {
    id: filename,
    filename,
    createdAt: date.toISOString(),
    reason: reason as VersionReason,
  };
}

export function requireVersionFilename(filename: string): void {
  if (!parseVersionFilename(filename)) throw new Error(`Invalid character version filename: ${filename}`);
}

/**
 * Allocate the first free millisecond. This keeps names sortable and prevents a rapid double
 * action from overwriting an existing snapshot without adding random or proprietary metadata.
 */
export function allocateVersion(
  now: Date,
  reason: VersionReason,
  existingFilenames: ReadonlySet<string>,
): CharacterVersion {
  let date = new Date(now.getTime());
  let filename = versionFilename(date, reason);
  while (existingFilenames.has(filename)) {
    date = new Date(date.getTime() + 1);
    filename = versionFilename(date, reason);
  }
  return { id: filename, filename, createdAt: date.toISOString(), reason };
}

export function sortVersionsNewestFirst(versions: CharacterVersion[]): CharacterVersion[] {
  return [...versions].sort((a, b) => b.filename.localeCompare(a.filename));
}
