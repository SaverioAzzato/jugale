import attributesImage from "../assets/en/attributes.png";
import editImage from "../assets/en/edit.png";
import inventoryImage from "../assets/en/inventory.png";
import playImage from "../assets/en/play.png";
import promptsImage from "../assets/en/prompts.png";
import rawJsonImage from "../assets/en/raw-json.png";
import storyImage from "../assets/en/story.png";
import welcomeImage from "../assets/en/welcome.png";
import { assertHelpCatalog, type HelpCatalog } from "../model";

export const helpEn: HelpCatalog = assertHelpCatalog({
  heroTitle: "How to use :JUGALE",
  topics: [
    {
      id: "start",
      title: "Start with JUGALE",
      summary: "Create, edit and validate your characters with your favourite chatbot, then open and play them with JUGALE.",
      sections: [
        {
          title: "What you need",
          intro: "To create your character in JUGALE, prepare a folder and open it from the home screen with Open folder. The folder always stays yours and contains:",
          files: [
            { name: "character.json", description: "Your character sheet. You can create it with your favourite chatbot using the prompts in {book}." },
            { name: "images/", description: "The images you want to see on the sheet, displayed in alphabetical order." },
            { name: "history/", description: "Chronological versions of your character. It is optional: JUGALE creates it automatically when you save your first version." },
          ],
          note: "You can also open character.json on its own: the sheet still works, but without images or version history.",
          links: [
            { topicId: "files", label: "See how a character folder works" },
            { topicId: "json", label: "See what character.json contains" },
          ],
        },
        {
          title: "Create your first character",
          intro: "character.json is readable text that you can edit yourself or create with a GPT. JUGALE prepares the prompt and the exact file format for you.",
          links: [
            { topicId: "chatbots", label: "Create one with a GPT" },
            { topicId: "json", label: "Understand the JSON file" },
          ],
        },
        {
          title: "Open it and play",
          intro: "Choose Open folder and select the folder that contains character.json. Use Open JSON only when you have the file without its folder.",
          media: {
            src: welcomeImage,
            alt: "JUGALE welcome screen with Open folder and Open JSON buttons",
            caption: "Open folder keeps the character, images and versions together.",
          },
          steps: [
            "Stay in Play to manage HP, resources, rests, attacks and spells.",
            "Use the tabs at the top to see attributes, inventory and story.",
            "Tap {pencil} when you want to change the character sheet itself.",
          ],
          links: [
            { topicId: "play", label: "See how the sheet works" },
            { topicId: "manage", label: "Edit and save" },
          ],
        },
        {
          title: "Just looking around?",
          intro: "Open Try an example on the welcome screen. You can explore every section without touching your files.",
        },
      ],
    },
    {
      id: "play",
      title: "Use the character sheet",
      summary: "Find HP, rolls, abilities, equipment and story at a glance.",
      sections: [
        {
          title: "The four sections",
          intro: "Everything you need is grouped into four tabs. Empty Inventory or Story tabs may appear after you add content in Edit mode.",
          gallery: [
            {
              title: "Play",
              body: "Use Damage and Heal for HP. The same page holds temporary HP, rests, conditions, resources, attacks and spells.",
              media: { src: playImage, alt: "Play tab showing HP and session actions", caption: "Play is the page to keep open at the table." },
            },
            {
              title: "Attributes",
              body: "Check ability scores, saving throws, skills, senses, proficiencies, features and feats.",
              media: { src: attributesImage, alt: "Attributes tab showing ability scores and skills", caption: "Bonuses and saving throws are already calculated for you." },
            },
            {
              title: "Inventory",
              body: "Equip weapons and armour, spend consumables, and update quantities and money with the plus and minus controls.",
              media: { src: inventoryImage, alt: "Inventory tab with equipment, consumables and currency", caption: "Equipment and quantities stay together in Inventory." },
            },
            {
              title: "Story",
              body: "See the portrait, gallery, description, background and personal notes.",
              media: { src: storyImage, alt: "Story tab with portrait and gallery", caption: "Images appear here when you open a character folder." },
            },
          ],
        },
        {
          title: "Useful actions during a game",
          bullets: [
            "Tap an attack or spell to open all of its details.",
            "Use Short rest or Long rest to recover everything configured for that rest.",
            "Tap the die in the top bar whenever you need a roll.",
            "Use + condition and Inspiration in Play to keep the current situation visible.",
          ],
        },
      ],
    },
    {
      id: "manage",
      title: "Edit and save",
      summary: "Change the sheet, keep a checkpoint and undo a bad update.",
      sections: [
        {
          title: "Change the character",
          media: {
            src: editImage,
            alt: "Character sheet in Edit mode with editable fields and Add buttons",
            caption: "The highlighted pencil means Edit mode is active.",
          },
          steps: ["Tap {pencil} in the top bar.", "Open the section you need and change its fields.", "Tap {pencil} again when you are done."],
        },
        {
          title: "Keep and restore versions",
          bullets: [
            "Save version creates a checkpoint. You can give it a short title or leave it unnamed.",
            "Versions shows your checkpoints. From there you can restore one or delete it.",
            "Before restoring, JUGALE asks whether you also want to keep the current state.",
          ],
          details: [{ title: "I cannot find Save version", paragraphs: ["Versions are available when JUGALE can save directly in the character folder. Open the complete folder instead of a single exported copy."] }],
        },
        {
          title: "Make sure your changes are kept",
          intro: "A character opened from its folder is saved as you work. If JUGALE offers Export JSON instead, use it before closing and keep the downloaded file.",
        },
      ],
    },
    {
      id: "chatbots",
      title: "Update with a chatbot",
      summary: "Send the right material to the chatbot you already use and bring the result back.",
      sections: [
        {
          title: "Choose what you want to do",
          intro: "Open {book} and choose what you want to do. JUGALE prepares everything for the chatbot you already use.",
          media: {
            src: promptsImage,
            alt: "Prompts page with character parameters and prompt actions",
            caption: "Use {book} in the top bar to open Prompts.",
          },
          bullets: [
            "Create starts a new character.",
            "Level up changes the open character after a level gain.",
            "Validate checks and repairs a character.",
            "Migrate updates a character made for an older JUGALE format.",
            "Custom adds your own request.",
          ],
        },
        {
          title: "On Android",
          flow: ["Open Prompts", "Tap Share", "Choose a chatbot", "Finish the update", "Share character.json back to JUGALE"],
          steps: ["Check the character name and the destination shown by JUGALE.", "Choose another character folder if needed.", "Confirm only when both are correct."],
          details: [{ title: "The chatbot returned JSON as a message, not a file", paragraphs: ["Copy the complete JSON into a plain-text file named character.json, then share that file to JUGALE."] }],
        },
        {
          title: "On web or desktop",
          steps: ["Open Prompts and choose the task.", "Copy the prompt and download the files offered by JUGALE.", "Attach them in your chatbot conversation.", "Save the final answer as character.json, then open that file or place it back in the character folder."],
        },
      ],
    },
    {
      id: "files",
      title: "Add images and manage files",
      summary: "Add a portrait, move a complete character and understand Recent.",
      sections: [
        {
          title: "Add a portrait or gallery",
          media: {
            src: storyImage,
            alt: "Story tab showing a portrait and image thumbnails",
            caption: "The first image alphabetically becomes the portrait; the others form the gallery.",
          },
          steps: ["Open the character folder on your device.", "Create an images folder beside character.json if it does not exist.", "Put your images inside and give them ordered names such as 01-portrait.jpg and 02-party.png.", "Reopen the character folder in JUGALE."],
        },
        {
          title: "What to copy when you move a character",
          files: [
            { name: "character.json", description: "The character itself. Always keep this file." },
            { name: "images/", description: "Optional portrait and gallery." },
            { name: "history/", description: "Optional saved versions. Copy it if you want to keep them." },
          ],
          intro: "Inside a complete character folder you will find the items below. Copy the whole folder when you want the same character, images and versions on another device.",
        },
        {
          title: "Recent characters",
          bullets: ["Tap a Recent entry to reopen it quickly.", "Removing an entry from Recent does not delete your original character or images."],
          links: [{ topicId: "manage", label: "How versions work" }],
        },
      ],
    },
    {
      id: "json",
      title: "Advanced: JSON and schema",
      summary: "For people who want to edit character.json by hand or use an external editor.",
      sections: [
        {
          title: "You can usually skip this section",
          intro: "The normal sheet and Edit mode are enough for everyday use. Raw JSON is useful only when you want direct control over the source file.",
        },
        {
          title: "Edit the source directly",
          media: {
            src: rawJsonImage,
            alt: "Raw JSON editor showing a valid character file",
            caption: "The editor reports whether the JSON is valid before you return to the sheet.",
          },
          steps: ["Open Raw JSON from the top bar.", "Make your change without removing unrelated sections.", "Fix any syntax error shown by the editor, then close it to return to the sheet."],
          details: [{ title: "Smallest valid example", paragraphs: ["{ \"meta\": { \"name\": \"My character\" } }"] }],
        },
        {
          title: "Use the JSON Schema",
          intro: "Download character.schema.json from Prompts when an editor or chatbot needs the exact list of accepted fields. It describes the file; it is not your character.",
          bullets: ["Keep character.json as the file you play with.", "Export or save a version before a large manual change.", "If a file no longer opens, restore a version or correct the JSON syntax in a text editor."],
        },
      ],
    },
  ],
});
