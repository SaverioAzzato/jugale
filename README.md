# :JUGALE — "Your character, always yours."

*Pronounced /juˈɡaːle/ — "yoo-GAH-leh".*

A character-sheet platform for tabletop RPGs (D&D 5e in practice) where **the JSON is the character** and the app is a beautiful, stateless lens over it. Build and edit characters with any chatbot (or by hand), then view and *play* them — track HP, resources, spell slots, currencies — with the app kept in sync with a plain, open `character.json`.

## Use it

No install, no account, no subscription:

- **Web** — open the live app: **[saverioazzato.github.io/jugale](https://saverioazzato.github.io/jugale/)**. Works in any modern browser; Chromium browsers also save your changes live.
- **Desktop & mobile** — download an installer (Mac / Windows / Linux) or the Android APK from **[Releases](https://github.com/SaverioAzzato/jugale/releases)**.

> **First launch on macOS:** the app isn't notarized yet (that needs a paid Apple account), so Gatekeeper blocks it once with *"Apple could not verify JUGALE.app is free of malware."* On **macOS 15 (Sequoia)** the old right-click → Open trick no longer bypasses this — instead: try to open it, then go to **System Settings → Privacy & Security → scroll down → "Open Anyway"** (one time, then it's remembered). Or, from Terminal: `xattr -dr com.apple.quarantine /Applications/JUGALE.app` (adjust the path if it's elsewhere). On older macOS, right-click → Open → Open still works. On **Android**, allow "install unknown apps" for your browser/file manager to sideload the APK.

Then, on the welcome screen:

1. **Have a character already?** Open its `character.json` (or its folder, to get the portrait too). Recently-opened characters are one click away.
2. **Starting fresh?** Build one with any chatbot using the in-app **Prompts** (the book icon) — they walk you through 5e rules one decision at a time — or turn on **Edit mode** (the pencil) and fill the sheet in by hand. New to the format? See the in-app **Help** (the **?**) or [docs/SCHEMA.md](docs/SCHEMA.md).

> **Status:** the generalized v2 app is live on web, desktop, and Android. The original vanilla-JS prototype is retired and preserved at [`prototype-v1`](https://github.com/SaverioAzzato/jugale/releases/tag/prototype-v1). The [roadmap](docs/ROADMAP.md) records the completed milestones and remaining polish.

## Why

Existing tools lock your character behind their UI and account. Here the source of truth is a human- and GPT-readable `character.json` + an `images/` folder. You can edit it in the app, by hand, or with any external chatbot — no subscription, no lock-in. The same app ships everywhere: **web** (GitHub Pages), **desktop**, and **mobile**, all from one codebase.

## Run from source

For development or building it yourself (end users don't need any of this — just use the [links above](#use-it)):

```bash
npm install
npm run dev        # Vite dev server
npm run preview    # preview the production build locally
npm test           # Vitest unit tests
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # production web build
```

Requires Node 20+.

### Desktop (Tauri)

```bash
npm run tauri dev    # native window, hot-reloading the same web build
npm run tauri build   # installable app bundle in src-tauri/target/release/bundle/
```

Requires a Rust toolchain ([rustup](https://rustup.rs)) in addition to Node. The desktop shell wraps the exact same frontend; native file/folder access (`src/storage/tauriProvider.ts`) replaces the browser's File System Access API one-for-one — nothing in `src/render`, `src/schema`, or `src/state` knows which host it's running on.

Android (`npm run tauri android dev` / `build`) shares the same config and requires the Android SDK + NDK + a local `tauri android init` first ([Tauri Android prerequisites](https://v2.tauri.app/start/prerequisites/)); CI builds and attaches a release-signed APK on every tagged release, so this is only needed for local device testing.

## Project structure

```
src/
  schema/        # Zod contract (v2.2), migrations, derivation, validation, JSON Schema
  model/ state/  # game operations and the live Zustand character store
  render/ ui/    # data-driven sheet, editor, dice, settings, prompts, updates
  storage/       # browser, desktop and Android StorageProvider implementations
  i18n/ theme/   # localization and visual themes
src-tauri/       # Tauri 2 desktop/mobile shell + Android filesystem/updater plugins
docs/            # spec-first: ARCHITECTURE, SCHEMA, ROADMAP, AUTOMATION
characters/      # sample characters (also test fixtures); your real PGs go in pg/ (gitignored)
index.html       # Vite entry
```

## The `character.json` contract

A character is a folder: `character.json` + `images/`. The JSON is structured enough to validate rules and generate the UI, free enough for any class or homebrew (generic resources, custom sections, links and notes everywhere), and simple enough for an LLM to edit by hand. **[docs/SCHEMA.md](docs/SCHEMA.md)** is both the full contract and the field-by-field user guide for writing or editing one by hand — section by section, with examples and a worked sample at the end.

Rule of thumb: almost everything is **structural** (changes only on level-up/edit); a small enumerated set is **live** play-state (HP, resource `current`, item quantities, currencies, conditions). The UI only mutates the live fields continuously.

### Where each 5e concept lives

Every game concept has **one home** in the JSON and one place it's edited (in Edit mode — the toolbar pencil — every row below becomes an inline editor). Outputs the rules compute for you (modifiers, proficiency bonus, save DCs, spell attack, total level, passive Perception, attunement count, derived AC) are **never stored** — the app derives them at render time, so you only ever edit the inputs.

| 5e concept | JSON home | Tab → section |
|---|---|---|
| Character name, player, summary, rules in scope | `meta` | header · Story |
| Race, lineage, background, alignment, size, age | `identity` | Attributi → Identity (edit) · Story → Bio |
| Class(es), level, subclass, hit die — multiclass = more entries | `classes[]` | Attributi → Identity |
| Caster ability, known vs. prepared, slot progression | `classes[].spellcasting` | Attributi → Identity |
| Ability scores + saving-throw proficiency | `abilities` | Attributi → Abilities |
| Skill proficiency & expertise | `proficiencies.skills` | Attributi → Skills |
| Armor / weapon / tool proficiencies, **languages** | `proficiencies` | Attributi → Proficiencies |
| Special senses (darkvision, blindsight…) | `senses[]` | Attributi → Senses & defenses |
| Damage resistances / immunities / vulnerabilities, condition immunities | `defenses` | Attributi → Senses & defenses |
| Hit points (max / current / temp), hit dice | `combat.hp` | Gioco → Vitals |
| Armor Class (summed from equipped armor/shield, or override; else 10 + Dex) | `inventory.items[].ac` · `combat.armorClassOverride` | Gioco → Vitals · Inventario |
| Initiative, speed | `combat.initiativeOverride` · `combat.speed` | Gioco → Vitals |
| Weapon attacks (per mode: 1h / 2h / thrown) | `inventory.items[].attacks[]` | Inventario (edit) → Gioco → Attacks |
| Innate attacks (natural weapons, unarmed, breath weapon) | `combat.attacks[]` | Gioco → Attacks |
| Spell slots, pact magic, ki, rage, sorcery points, channel divinity, charges, ammo | `resources[]` (generic) | Gioco → Resources |
| Spells (casting time, ritual, V·S·M components + materials, damage & type, higher-level scaling), grouped into sections | `spellSections[]` | Gioco → Spells |
| Class / subclass / race / background / feat features (invocations, metamagic, maneuvers, fighting styles…) | `features[]` (by `source`) | Attributi → Features |
| Limited-use feature → its resource | `features[].uses` | Attributi → Features |
| Items: quantity, weight, value, equipped, attuned, category | `inventory.items[]` | Inventario |
| Currencies | `inventory.currencies` | Inventario |
| Racial traits, background feature | `origin` | Story → Origin |
| Personality, ideals, bonds, flaws, appearance, backstory | `narrative` | Story |
| Portrait & gallery | the folder's `images/` (never in the JSON) | header · Story |
| Conditions, inspiration, death saves, session notes (live) | `session` | Gioco → Status |
| Rests & one-tap custom effects (formula-driven) | `actions[]` | Gioco → Actions |
| Anything the schema doesn't anticipate (homebrew tables, checklists…) | `customSections[]` | Story → Custom |

When you change the schema, see the checklist in [docs/SCHEMA.md](docs/SCHEMA.md#6-changing-the-schema) for every place that has to move together.

## GPT prompts

Four copy-ready prompts — **base / create / level-up / validate** — let any external chatbot (ChatGPT, Claude, etc.) build, level up, and validate a character against this app's `character.json` contract. Available in-app (the book icon next to Settings, with a one-click JSON Schema download) and documented in **[docs/PROMPTS.md](docs/PROMPTS.md)**.

## Content & licensing

By default, characters ship with `meta.ruleset: ["SRD"]` — the freely-licensed D&D 5e System Reference Document. Nothing in the schema, the prompts, or the `.github/agents/` seed material hardcodes a commercial sourcebook. You're free to point your own character (or chatbot session) at other guides — Xanathar's Guide to Everything, Tasha's Cauldron of Everything, third-party homebrew, etc. — *as an example* — but that's your own choice. **It's your responsibility to hold the rights/license to that material, to respect its license terms and any usage policy, and to use it responsibly and legally.** Neither this project nor its maintainers are responsible for misuse of copyrighted content by users.

## Distribution

Free and open: the **web app is the GitHub Pages site** ([live](https://saverioazzato.github.io/jugale/)); desktop and Android binaries are attached to **GitHub Releases**. Both are built and shipped by GitHub Actions, and both happen on the same trigger: **pushing a version tag** (`v*`) — [`pages.yml`](.github/workflows/pages.yml) redeploys the web app, [`release.yml`](.github/workflows/release.yml) builds Mac/Win/Linux installers plus an Android APK and attaches them to a draft GitHub Release. Desktop uses signed Tauri updater artifacts; Android checks the same releases in-app and installs a release-signed APK through its native updater. Merging to `main` alone does not ship a release. Before tagging, run [`scripts/set-version.sh`](scripts/set-version.sh) to keep `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock` aligned with the tag; see [Cutting a release](docs/AUTOMATION.md#cutting-a-release). No app stores, no hosting bills.

## Contributing & automation

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the project's ground rules before sending a PR.

- CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every PR; a PR touching `src-tauri/` also gets a fast Rust `cargo check` (`tauri-check.yml`, no bundling).
- You can hand Claude a ticket and get a PR back — via [Claude Code on the web](https://claude.ai/code) (runs on Anthropic's cloud) or a local Claude Code session. See **[docs/AUTOMATION.md](docs/AUTOMATION.md)**.

## Docs

- [Architecture](docs/ARCHITECTURE.md) · [Schema](docs/SCHEMA.md) · [UI](docs/UI.md) · [Prompts](docs/PROMPTS.md) · [Roadmap](docs/ROADMAP.md) · [Automation](docs/AUTOMATION.md)

## Assets & Credits

The example character images in [`characters/example-warlock/images/`](characters/example-warlock/images/) were generated with **ChatGPT (OpenAI)** and are included for demonstration purposes only. These generated assets are example content and are **not part of the software license** — they're separate from the code.

## License

The **code** is released under the [MIT License](LICENSE). This covers the application only — D&D rules content is a separate matter (see [Content & licensing](#content--licensing) above), and the example images are credited under [Assets & Credits](#assets--credits).
