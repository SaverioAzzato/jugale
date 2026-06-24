import { describe, expect, it } from "vitest";
import { loadCharacter } from "../schema";
import { getVisibleTabs } from "./tabs";

/** A bare character: only Play + Attributes show; Inventory/Story are content-gated. */
const bare = () => loadCharacter({ meta: { name: "Nobody" } }).character!;

describe("getVisibleTabs", () => {
  it("shows only Play + Attributes for an empty character", () => {
    expect(getVisibleTabs(bare()).map((t) => t.id)).toEqual(["gioco", "scheda"]);
  });

  it("surfaces the Story tab when a loaded folder supplied images, even with no prose", () => {
    const ids = getVisibleTabs(bare(), true).map((t) => t.id);
    expect(ids).toContain("storia");
  });
});
