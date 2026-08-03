import { CharacterSchema, type Character } from "./character";
import { hasFutureSchema, migrateToCurrent, needsMigration } from "./migrate";
import { isBodyArmor } from "./derive";

export type Severity = "error" | "warning";

/**
 * Stable identifier for a rule-check issue, so the UI can render a localized message.
 * "schema" covers raw Zod validation errors, whose `message` is Zod's own (English,
 * technical) text — those aren't enumerable, so they're shown as-is rather than localized.
 */
export type IssueCode =
  | "schema"
  | "levelExceeds20"
  | "proficiencyBonusMismatch"
  | "resourceOverspent"
  | "hpExceedsMax"
  | "spellMaterialMissing"
  | "spellRitualNoDuration"
  | "multipleBodyArmor"
  | "futureSchema";

export interface Issue {
  path: string;
  /** English fallback text — always present, shown verbatim for code "schema". */
  message: string;
  severity: Severity;
  code: IssueCode;
  /** Interpolation values for the UI's localized message (unused for code "schema"). */
  params?: Record<string, string | number>;
}

const persistableDocumentBrand: unique symbol = Symbol("PersistableCharacterDocument");

/** Proof produced only by this module after current-schema validation succeeds. */
export interface PersistableCharacterDocument {
  readonly document: unknown;
  readonly [persistableDocumentBrand]: true;
}

export type CharacterValidation =
  | { kind: "valid"; persistable: PersistableCharacterDocument; issues: Issue[] }
  | { kind: "schema-invalid"; issues: Issue[] }
  | { kind: "future-schema"; schemaVersion: string; issues: Issue[] };

export interface LoadResult {
  /** Parsed input before migration. Never synthesized from the projection. */
  source: unknown;
  /** Lossless working document after supported migrations. The only persistence candidate. */
  draft: unknown;
  /** Safe value for the renderer. Defaults here must never be persisted. */
  projection: Character;
  validation: CharacterValidation;
  /** Backward-compatible renderer alias. */
  character: Character;
  issues: Issue[];
  migrated: boolean;
  ok: boolean;
}

function cloneJson<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

function fallbackName(data: unknown): string {
  const name = (data as { meta?: { name?: unknown } } | null)?.meta?.name;
  return name != null ? String(name) : "Personaggio";
}

/** Keep every valid top-level section in the renderer while defaulting only broken sections. */
function bestEffortProjection(data: unknown): Character {
  const baseInput: Record<string, unknown> = { meta: { name: fallbackName(data) } };
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return CharacterSchema.parse(baseInput);
  }

  let candidate = baseInput;
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const trial = { ...candidate, [key]: value };
    if (CharacterSchema.safeParse(trial).success) candidate = trial;
  }
  return CharacterSchema.parse(candidate);
}

/**
 * Loads raw JSON into a validated Character. Never throws and always returns a
 * renderable character: schema failures become `error` issues and the caller
 * still gets a usable (default-filled) object so a half-edited file is never
 * locked out. Rule inconsistencies are `warning` issues.
 */
export function loadCharacter(raw: unknown): LoadResult {
  const source = cloneJson(raw);
  const future = hasFutureSchema(source);
  const migrated = !future && needsMigration(source);
  const draft = future ? cloneJson(source) : migrateToCurrent(cloneJson(source));

  if (future) {
    const schemaVersion = String((source as { schemaVersion?: unknown } | null)?.schemaVersion ?? "");
    const issues: Issue[] = [{
      path: "schemaVersion",
      message: `Schema version ${schemaVersion} is newer than the supported version`,
      severity: "error",
      code: "futureSchema",
      params: { schemaVersion },
    }];
    const projection = bestEffortProjection(draft);
    const validation: CharacterValidation = { kind: "future-schema", schemaVersion, issues };
    return { source, draft, projection, validation, character: projection, issues, migrated: false, ok: false };
  }

  const parsed = CharacterSchema.safeParse(draft);
  if (parsed.success) {
    const issues = ruleChecks(parsed.data);
    const persistable = {
      document: draft,
      [persistableDocumentBrand]: true,
    } as PersistableCharacterDocument;
    const validation: CharacterValidation = { kind: "valid", persistable, issues };
    return {
      source,
      draft,
      projection: parsed.data,
      validation,
      character: parsed.data,
      issues,
      migrated,
      ok: true,
    };
  }

  const issues: Issue[] = parsed.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
    severity: "error",
    code: "schema",
  }));
  const projection = bestEffortProjection(draft);
  const validation: CharacterValidation = { kind: "schema-invalid", issues };
  return { source, draft, projection, validation, character: projection, issues, migrated, ok: false };
}

/** 5e consistency checks. Non-blocking warnings surfaced in the UI + validate prompt. */
export function ruleChecks(c: Character): Issue[] {
  const issues: Issue[] = [];

  const level = c.classes.reduce((sum, x) => sum + x.level, 0);
  if (level > 20) {
    issues.push({
      path: "classes",
      message: `Total level ${level} exceeds 20`,
      severity: "warning",
      code: "levelExceeds20",
      params: { level },
    });
  }

  const override = c.proficiencies.proficiencyBonusOverride;
  if (override != null) {
    const derived = Math.floor((Math.max(1, level) - 1) / 4) + 2;
    if (override !== derived) {
      issues.push({
        path: "proficiencies.proficiencyBonusOverride",
        message: `Proficiency bonus ${override} disagrees with the derived ${derived} for level ${level}`,
        severity: "warning",
        code: "proficiencyBonusMismatch",
        params: { override, derived, level },
      });
    }
  }

  for (const r of c.resources) {
    if (r.current > r.max) {
      issues.push({
        path: `resources.${r.id}`,
        message: `${r.label || r.id}: current uses (${r.current}) exceed the max (${r.max})`,
        severity: "warning",
        code: "resourceOverspent",
        params: { label: r.label || r.id, current: r.current, max: r.max },
      });
    }
  }

  // AC: only one suit of body armor can be worn at a time (bases don't stack; shields are a
  // separate bonus). We still render a summed AC, but flag the illegal setup so it's visible.
  const bodyArmor = c.inventory.items.filter((it) => it.equipped && isBodyArmor(it));
  if (bodyArmor.length > 1) {
    issues.push({
      path: "inventory.items",
      message: `${bodyArmor.length} body-armor items are equipped at once; only one may be worn`,
      severity: "warning",
      code: "multipleBodyArmor",
      params: { count: bodyArmor.length },
    });
  }

  if (c.combat.hp.max > 0 && c.combat.hp.current > c.combat.hp.max + c.combat.hp.temp) {
    issues.push({
      path: "combat.hp",
      message: "Current HP exceeds max + temporary",
      severity: "warning",
      code: "hpExceedsMax",
    });
  }

  // Spell completeness: a material component with nothing listed, or a ritual with no duration.
  c.spellSections.forEach((sec, si) => {
    sec.entries.forEach((s, ei) => {
      const path = `spellSections.${si}.entries.${ei}`;
      const label = s.name || `#${ei + 1}`;
      if (s.components.material && s.materials.length === 0) {
        issues.push({
          path,
          message: `${label}: has a material component but no materials listed`,
          severity: "warning",
          code: "spellMaterialMissing",
          params: { label },
        });
      }
      if (s.ritual && !s.duration.trim()) {
        issues.push({
          path,
          message: `${label}: is a ritual but has no duration`,
          severity: "warning",
          code: "spellRitualNoDuration",
          params: { label },
        });
      }
    });
  });

  return issues;
}
