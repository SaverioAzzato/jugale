import { describe, expect, it } from "vitest";
import { helpEn } from "./content/en";
import { helpIt } from "./content/it";
import { HELP_TOPIC_IDS } from "./model";

describe("help catalogs", () => {
  it("keep EN and IT in the same canonical topic order", () => {
    expect(helpEn.topics.map((topic) => topic.id)).toEqual(HELP_TOPIC_IDS);
    expect(helpIt.topics.map((topic) => topic.id)).toEqual(HELP_TOPIC_IDS);
    expect(helpIt.topics.map((topic) => topic.sections.length)).toEqual(
      helpEn.topics.map((topic) => topic.sections.length),
    );
  });

  it("keeps user-facing topics visual and free of implementation jargon", () => {
    for (const catalog of [helpEn, helpIt]) {
      for (const topic of catalog.topics.filter((topic) => topic.id !== "json")) {
        const media = topic.sections.flatMap((section) => [section.media, ...(section.gallery?.map((item) => item.media) ?? [])]).filter(Boolean);
        expect(media.length).toBeGreaterThan(0);
        for (const item of media) {
          expect(item?.src).toBeTruthy();
          expect(item?.alt.trim()).toBeTruthy();
          expect(item?.caption.trim()).toBeTruthy();
        }
      }
      const prose = JSON.stringify(catalog).toLowerCase();
      for (const jargon of ["live sync", "in memory", "read-only", "documentsprovider", "action_send", "mime", "utf-8"]) {
        expect(prose).not.toContain(jargon);
      }
    }
  });
});
