/*
 * Upgrade a v1 character.json to the current schema, in place.
 *
 *   npx tsx scripts/migrate-character.ts <path/to/character.json>
 *
 * Writes the migrated v2 file back to the same path and keeps a `*.v1.backup.json`
 * copy of the original. Prints a report of what changed and any validation issues.
 * The app does this automatically on load too — this is for batch/offline use.
 */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { loadCharacter } from "../src/schema/index";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx scripts/migrate-character.ts <path/to/character.json>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path, "utf8"));
const before = raw.schemaVersion;
const result = loadCharacter(raw);

const backup = path.replace(/\.json$/, ".v1.backup.json");
copyFileSync(path, backup);
writeFileSync(path, JSON.stringify(result.character, null, 2) + "\n");

const log = (s: string) => process.stdout.write(s + "\n");
log(`Migrated ${path}`);
log(`  schemaVersion: ${before} -> ${result.character.schemaVersion}  (migrated: ${result.migrated})`);
log(`  backup written: ${backup}`);
log(`  validation: ${result.ok ? "ok" : "ERRORS"} · ${result.issues.length} issue(s)`);
for (const i of result.issues) log(`    [${i.severity}] ${i.path || "(root)"}: ${i.message}`);
log(`  classes: ${result.character.classes.map((c) => `${c.name} ${c.level}`).join(", ") || "—"}`);
log(`  resources: ${result.character.resources.map((r) => `${r.label} ${r.current}/${r.max}`).join(" | ") || "—"}`);
log(`  preserved sections: ${result.character.customSections.map((s) => s.title).join(", ") || "—"}`);
