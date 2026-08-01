# Legal & content notices

> Last reviewed: 2026-08-01. This page records the project's licensing choices; it is not legal advice.

## Independent project

JUGALE is an independent, free and open-source project. It is not affiliated with, endorsed, sponsored, or approved by Wizards of the Coast. The project does not use Wizards logos, trade dress, official artwork, video, or music; bundled rules-derived text and names are confined to the SRD material identified below.

References to D&D and fifth edition describe compatibility and the rules context. They do not grant or imply trademark rights or official status.

The non-affiliation sentence is a factual status/trademark disclaimer. It is not an additional attribution for the SRD, does not modify the attribution statement below, and does not claim permission under the Fan Content Policy.

## Which SRD

JUGALE's bundled examples and default prompts use **System Reference Document 5.1 (SRD 5.1)**: the 2014 fifth-edition rules released under CC BY 4.0. Ordinary character names, stories, and background labels in the examples are descriptive or original; they do not import non-SRD background rules. The default is therefore:

```json
{ "meta": { "ruleset": ["SRD 5.1"] } }
```

**SRD 5.2.1 is a different rules line:** it reflects the revised 2024 rules, often called 5.5e. JUGALE's schema can represent either line, but a character or prompt that uses SRD 5.2.1 must name it explicitly. The bare label `"SRD"` is deprecated because it does not tell a person or chatbot which mechanics to apply. Listing both versions is allowed by their licences, but it should be a deliberate user choice and requires resolving rules differences rather than silently mixing them.

JUGALE's `schemaVersion` (currently 2.2.0) versions the JSON file format. It has no relationship to SRD 5.1 or SRD 5.2.1.

Official sources: [SRD download and FAQ](https://www.dndbeyond.com/srd), [SRD 5.1 PDF](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf), and [SRD 5.2.1 PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf).

## SRD 5.1 attribution

The bundled example character data contains selected, shortened, translated, adapted, and structurally encoded SRD 5.1 material. The attribution statement requested by the SRD 5.1 legal notice is:

> This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

The preceding description identifies JUGALE's modifications as required by [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode).

JUGALE does not currently bundle SRD 5.2.1-derived example content. If that changes, the separate attribution statement printed in the SRD 5.2.1 legal notice must be added here and alongside the distributed content.

## Why this is not a Fan Content Policy notice

The SRD licence and Wizards' Fan Content Policy are different permission paths. The SRD PDFs expressly license their rules material under CC BY 4.0, including commercial reuse with attribution. The Fan Content Policy instead covers fan works that use other Wizards IP and adds materially different conditions, including free access, a prescribed unofficial-fan-content notice, restrictions on trademarks, and other obligations.

JUGALE relies on **CC BY 4.0 for its bundled SRD rules material**, not on the Fan Content Policy. It therefore does not describe itself as “unofficial Fan Content permitted under the Fan Content Policy.” The independent-project disclaimer above avoids any suggestion of endorsement without claiming a licence JUGALE does not need. If future assets or text use Wizards IP outside an SRD, that addition needs its own review before release; adding the Fan Content Policy sentence alone is not enough.

Official reference: [Wizards Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).

## Code, fonts, images, and dependencies

- JUGALE application code is licensed under the repository's [MIT License](../LICENSE).
- The bundled Cinzel font is Copyright 2020 The Cinzel Project Authors and is distributed under the [SIL Open Font License 1.1](../public/CINZEL-OFL.txt). The complete notice is copied into every web/native frontend build as `CINZEL-OFL.txt`.
- Example character images were generated with ChatGPT by the project author. They are demonstration assets, are not official Wizards artwork, and are separate from the software's MIT licence. The project-owned example and documentation images are licensed, to the extent the author owns rights in them, under [CC BY 4.0](../ASSETS-LICENSE.md). OpenAI's [EU Terms of Use](https://openai.com/policies/eu-terms-of-use/) assign any rights it may have in output to the user while warning that output may not be unique; this does not eliminate the need to respect third-party rights.
- JavaScript and Rust dependencies remain under their own licences. `package-lock.json` and `src-tauri/Cargo.lock` pin the distributed cross-platform graph; their licences are not relicensed as MIT by this project. [`THIRD_PARTY_NOTICES.txt`](../public/THIRD_PARTY_NOTICES.txt) inventories each component and preserves packaged licence/notice texts, while the [SPDX 2.3 SBOM](../public/third-party-sbom.spdx.json) provides the same component set in machine-readable form. Both files are copied into the root of every web build and therefore into every Tauri frontend bundle.

The inventory deliberately covers the union of locked dependencies needed across supported platforms, including build-time/native branches, rather than claiming that every listed package is loaded on every operating system. A lockfile fingerprint and full Package URL list make staleness detectable. `npm run legal:check` fails if either generated file no longer matches the lockfiles; after changing a dependency, run `npm run legal:generate` and review the diff before release.

The current Rust graph includes unmodified MPL-2.0 components. Their entries retain or link the MPL text and provide an exact crates.io source archive in addition to the upstream repository; JUGALE's own files remain under MIT because MPL 2.0 is file-level, not a licence applied to the entire larger work. If JUGALE ever patches or vendors an MPL-covered source file, the modified source must remain available under MPL 2.0 and the notice/source entry must be updated.

## Character data, external links, and chatbot sharing

Users retain their own character files and images. JUGALE does not claim a licence to user-authored content merely because the app opens or edits it. Character authors remain responsible for material and links they add and for complying with applicable licences, site terms, privacy rights, and law.

JUGALE displays user-chosen links and opens them in the system browser; it does not fetch, scrape, cache, preview, proxy, index, or reproduce linked pages. A link does not imply affiliation, endorsement, or permission to copy its destination. Ownership of a book, account, or subscription likewise does not by itself permit scraping or sending its contents to an AI service.

On Android, sharing a prompt or importing a returned `character.json` happens only after an explicit user action through the system share interface. Once content is sent to an external chatbot or other app, that service's terms and privacy policy apply.

## Privacy and warranties

JUGALE has no project account system, advertising SDK, or analytics backend. Character data stays in the file or folder the user opens, apart from an explicit export/share action and the limited GitHub release check used for updates. User-supplied external links are opened only on request.

The web app and release downloads are hosted by GitHub. GitHub Pages records visitors' IP addresses for security purposes, and requests to Pages, Releases, or the GitHub API are handled under [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). The JUGALE project does not receive a character file through those requests and does not add its own tracking.

The MIT licence supplies the application “as is,” without warranty. CC BY 4.0 separately contains its own disclaimer of warranties and limitation of liability for SRD material.
