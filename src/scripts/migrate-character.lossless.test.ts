import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";

const fixtureDir = mkdtempSync(join(tmpdir(), "jugale-migrate-lossless-"));

afterAll(() => {
  rmSync(fixtureDir, { recursive: true });
});

describe("scripts/migrate-character.ts — fail-closed migration", () => {
  it("may create a backup but never overwrites or reports success for an invalid result", () => {
    const raw = {
      schemaVersion: "2.1.0",
      meta: { name: "Broken migration", unknownMeta: { keep: true } },
      classes: [{ name: "Wizard", level: "five", unknownClass: "keep" }],
      customUnknown: { top: [1, 2, 3] },
    };
    const file = join(fixtureDir, "character.json");
    const backup = join(fixtureDir, "character.v1.backup.json");
    writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`);

    const run = spawnSync(
      resolve("node_modules/.bin/vite-node"),
      ["--script", "scripts/migrate-character.ts", file],
      { cwd: resolve("."), encoding: "utf8" },
    );

    expect.soft(run.status, run.stderr).not.toBe(0);
    expect.soft(JSON.parse(readFileSync(file, "utf8"))).toEqual(raw);
    expect.soft(existsSync(backup)).toBe(true);
    expect.soft(run.stdout).not.toContain(`Migrated ${file}`);
  });
});
