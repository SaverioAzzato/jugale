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

  it("explains the complete Android share-back flow in both locales", () => {
    const enChatbots = JSON.stringify(helpEn.topics.find((topic) => topic.id === "chatbots"));
    expect(enChatbots).toContain("share that file and choose JUGALE or JUGALE Dev");
    expect(enChatbots).toContain("If no character is open");
    expect(enChatbots).toContain("Choose character folder");

    const itChatbots = JSON.stringify(helpIt.topics.find((topic) => topic.id === "chatbots"));
    expect(itChatbots).toContain("condividi quel file e scegli JUGALE oppure JUGALE Dev");
    expect(itChatbots).toContain("Se non hai un personaggio aperto");
    expect(itChatbots).toContain("Scegli cartella personaggio");
  });

  it("explains prompt bundle downloads on every host in both locales", () => {
    const enChatbots = JSON.stringify(helpEn.topics.find((topic) => topic.id === "chatbots"));
    expect(enChatbots).toContain("available on web, desktop and Android");
    expect(enChatbots).toContain("complete character.json");
    expect(enChatbots).toContain("schema changelog");
    expect(enChatbots).toContain("without opening a character");

    const itChatbots = JSON.stringify(helpIt.topics.find((topic) => topic.id === "chatbots"));
    expect(itChatbots).toContain("disponibile su web, desktop e Android");
    expect(itChatbots).toContain("character.json completo");
    expect(itChatbots).toContain("changelog dello schema");
    expect(itChatbots).toContain("senza aprire un personaggio");
  });

  it("explains safe manual JSON import in both locales", () => {
    const enChatbots = JSON.stringify(helpEn.topics.find((topic) => topic.id === "chatbots"));
    expect(enChatbots).toContain("Import character JSON");
    expect(enChatbots).toContain("previews the selected file");
    expect(enChatbots).toContain("first saves the current character in Versions");
    expect(enChatbots).toContain("truly empty folder");
    expect(enChatbots).toContain("version history");

    const itChatbots = JSON.stringify(helpIt.topics.find((topic) => topic.id === "chatbots"));
    expect(itChatbots).toContain("Importa JSON personaggio");
    expect(itChatbots).toContain("mostra un'anteprima");
    expect(itChatbots).toContain("salva prima il personaggio corrente in Versioni");
    expect(itChatbots).toContain("cartella davvero vuota");
    expect(itChatbots).toContain("Versioni");
  });
});
