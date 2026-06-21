import { CharacterSchema, type Character } from "./character";
import { migrateToCurrent, needsMigration } from "./migrate";

export type Severity = "error" | "warning";

export interface Issue {
  path: string;
  message: string;
  severity: Severity;
}

export interface LoadResult {
  character: Character;
  issues: Issue[];
  migrated: boolean;
  ok: boolean;
}

/**
 * Loads raw JSON into a validated Character. Never throws and always returns a
 * renderable character: schema failures become `error` issues and the caller
 * still gets a usable (default-filled) object so a half-edited file is never
 * locked out. Rule inconsistencies are `warning` issues.
 */
export function loadCharacter(raw: unknown): LoadResult {
  const migrated = needsMigration(raw);
  const data = migrateToCurrent(raw);

  const parsed = CharacterSchema.safeParse(data);
  if (parsed.success) {
    return { character: parsed.data, issues: ruleChecks(parsed.data), migrated, ok: true };
  }

  const issues: Issue[] = parsed.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
    severity: "error",
  }));
  const name =
    (data as { meta?: { name?: unknown } } | null)?.meta?.name != null
      ? String((data as { meta: { name: unknown } }).meta.name)
      : "Personaggio";
  const fallback = CharacterSchema.parse({ meta: { name } });
  return { character: fallback, issues, migrated, ok: false };
}

/** 5e consistency checks. Non-blocking warnings surfaced in the UI + validate prompt. */
export function ruleChecks(c: Character): Issue[] {
  const issues: Issue[] = [];

  const level = c.classes.reduce((sum, x) => sum + x.level, 0);
  if (level > 20) {
    issues.push({ path: "classes", message: `Livello totale ${level} supera 20`, severity: "warning" });
  }

  const override = c.proficiencies.proficiencyBonusOverride;
  if (override != null) {
    const derived = Math.floor((Math.max(1, level) - 1) / 4) + 2;
    if (override !== derived) {
      issues.push({
        path: "proficiencies.proficiencyBonusOverride",
        message: `Bonus competenza ${override} diverso dal derivato ${derived} per livello ${level}`,
        severity: "warning",
      });
    }
  }

  for (const r of c.resources) {
    if (r.current > r.max) {
      issues.push({
        path: `resources.${r.id}`,
        message: `${r.label || r.id}: usi correnti (${r.current}) maggiori del massimo (${r.max})`,
        severity: "warning",
      });
    }
  }

  if (c.combat.hp.max > 0 && c.combat.hp.current > c.combat.hp.max + c.combat.hp.temp) {
    issues.push({ path: "combat.hp", message: "PF correnti superano massimi + temporanei", severity: "warning" });
  }

  return issues;
}
