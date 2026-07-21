import { describe, expect, it } from "vitest";
import { toolbarCapacity } from "./toolbarLayout";

describe("toolbarCapacity", () => {
  it("keeps every action when they fit", () => {
    expect(toolbarCapacity(390, 34, 1, 6)).toBe(6);
  });

  it("reserves an overflow slot and keeps four actions at 120% mobile scale", () => {
    expect(toolbarCapacity(390, 34 * 1.2, 1.2, 6)).toBe(4);
  });

  it("accounts for fixed welcome-screen actions", () => {
    expect(toolbarCapacity(260, 34, 1, 3, 1)).toBe(1);
  });
});
