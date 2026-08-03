export const VERSION_REASONS = ["checkpoint", "before-import", "before-restore"] as const;

export type VersionReason = (typeof VERSION_REASONS)[number];

export interface CharacterVersion {
  id: string;
  filename: string;
  createdAt: string;
  reason: VersionReason;
  /** Optional user-authored label stored beside the snapshot, never in character.json. */
  title?: string;
}

export interface VersionStore {
  create(data: unknown, reason: VersionReason, title?: string, now?: Date): Promise<CharacterVersion>;
  list(): Promise<CharacterVersion[]>;
  read(version: CharacterVersion): Promise<unknown>;
  delete(version: CharacterVersion): Promise<void>;
}

/** Host primitives for the history directory; policy stays shared in this module. */
export interface VersionStorage {
  listNames(): Promise<string[]>;
  readText(filename: string): Promise<string>;
  writeText(filename: string, contents: string): Promise<void>;
  remove(filename: string): Promise<void>;
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
  if (!parseVersionFilename(filename)) {
    throw storageError("invalid-version-filename", undefined, `Invalid character version filename: ${filename}`);
  }
}

/** Sidecar metadata keeps history labels out of both the canonical character and its snapshots. */
export function versionMetadataFilename(filename: string): string {
  requireVersionFilename(filename);
  return `${filename.slice(0, -".json".length)}.meta.json`;
}

export function normalizeVersionTitle(title?: string): string | undefined {
  const normalized = title?.trim();
  return normalized ? normalized.slice(0, 120) : undefined;
}

export function readVersionTitle(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const title = (raw as { title?: unknown }).title;
  return typeof title === "string" ? normalizeVersionTitle(title) : undefined;
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

/**
 * Shared versioning policy for every host. Snapshot content is authoritative; optional title
 * sidecars are best-effort and can never turn a successful snapshot into a failed checkpoint.
 */
export function createVersionStore(storage: VersionStorage): VersionStore {
  return {
    create: async (data, reason, title, now = new Date()) => {
      const version = allocateVersion(now, reason, new Set(await storage.listNames()));
      await storage.writeText(version.filename, JSON.stringify(data, null, 2));
      const normalizedTitle = normalizeVersionTitle(title);
      if (normalizedTitle) {
        try {
          await storage.writeText(
            versionMetadataFilename(version.filename),
            JSON.stringify({ title: normalizedTitle }, null, 2),
          );
        } catch {
          return version;
        }
      }
      return { ...version, title: normalizedTitle };
    },
    list: async () => {
      const names = await storage.listNames();
      const versions = names.map(parseVersionFilename).filter((version) => version !== null);
      const titled = await Promise.all(versions.map(async (version) => {
        const metadata = versionMetadataFilename(version.filename);
        if (!names.includes(metadata)) return version;
        try {
          return { ...version, title: readVersionTitle(JSON.parse(await storage.readText(metadata))) };
        } catch {
          return version;
        }
      }));
      return sortVersionsNewestFirst(titled);
    },
    read: async (version) => {
      requireVersionFilename(version.filename);
      return JSON.parse(await storage.readText(version.filename));
    },
    delete: async (version) => {
      requireVersionFilename(version.filename);
      await storage.remove(version.filename);
      try {
        await storage.remove(versionMetadataFilename(version.filename));
      } catch {
        // Missing or failed optional metadata does not change snapshot deletion success.
      }
    },
  };
}
import { storageError } from "./errors";
