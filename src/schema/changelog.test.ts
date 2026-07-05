import { describe, expect, it } from "vitest";
import { SCHEMA_CHANGELOG } from "./changelog";
import { SCHEMA_VERSION } from "./character";

describe("SCHEMA_CHANGELOG", () => {
  it("states the current schema version as the migration target", () => {
    expect(SCHEMA_CHANGELOG).toContain(SCHEMA_VERSION);
  });

  it("documents every version step up to the current schema", () => {
    // A guard against bumping SCHEMA_VERSION without adding its changelog section.
    for (const step of ["1.0.0 → 2.0.0", "2.0.0 → 2.1.0", "2.1.0 → 2.2.0"]) {
      expect(SCHEMA_CHANGELOG).toContain(step);
    }
    // The final documented step must land on the current version.
    expect(SCHEMA_CHANGELOG).toContain(`→ ${SCHEMA_VERSION}`);
  });

  it("is reference data, not a prompt (no base-prompt boilerplate baked in)", () => {
    expect(SCHEMA_CHANGELOG).not.toContain("Content & licensing");
    expect(SCHEMA_CHANGELOG).not.toContain("Sources in scope");
  });
});
