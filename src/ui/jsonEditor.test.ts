import { describe, it, expect } from "vitest";
import { schemaDiagnosticsForText } from "./jsonEditor";

describe("schemaDiagnosticsForText", () => {
  it("returns nothing for unparseable JSON (the syntax linter handles that)", () => {
    expect(schemaDiagnosticsForText("{ not valid")).toEqual([]);
  });

  it("returns nothing for a clean minimal character", () => {
    expect(schemaDiagnosticsForText(JSON.stringify({ meta: { name: "Vex" } }))).toEqual([]);
  });

  it("flags a schema type error and points the range at the offending value", () => {
    const text = JSON.stringify({ meta: { name: "Vex" }, classes: 5 });
    const diags = schemaDiagnosticsForText(text);
    expect(diags.some((d) => d.severity === "error")).toBe(true);
    expect(diags.some((d) => text.slice(d.from, d.to) === "5")).toBe(true);
  });

  it("maps a rule-check warning to an array element found by its id (resources.<id>)", () => {
    const text = JSON.stringify(
      { meta: { name: "Vex" }, resources: [{ id: "ki", category: "charges", max: 2, current: 5, resetOn: "shortRest" }] },
      null,
      2,
    );
    const overspent = schemaDiagnosticsForText(text).find((d) => /exceed/i.test(d.message));
    expect(overspent?.severity).toBe("warning");
    // The squiggle lands on the offending resource object (located by id, not an index).
    expect(text.slice(overspent!.from, overspent!.to)).toContain('"ki"');
  });

  it("resolves a nested object path (combat.hp) for the HP-over-max warning", () => {
    const text = JSON.stringify({ meta: { name: "Vex" }, combat: { hp: { max: 10, current: 999 } } }, null, 2);
    const hp = schemaDiagnosticsForText(text).find((d) => /hp/i.test(d.message));
    expect(hp).toBeTruthy();
    expect(text.slice(hp!.from, hp!.to)).toContain('"current"'); // range covers the hp object
  });
});
