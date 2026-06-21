# D&D Manager — "D&D, but Digital"

A character-sheet platform for tabletop RPGs (D&D 5e in practice) where **the JSON is the character** and the app is a beautiful, stateless lens over it. Build and edit characters with any chatbot (or by hand), then view and *play* them — track HP, resources, spell slots, currencies — with the app kept in sync with a plain, open `character.json`.

> **Status:** mid-rewrite. The generalized v2 engine lives at the repo root (React + Vite + TypeScript). The original vanilla-JS prototype was retired when the rewrite began — it's tagged [`prototype-v1`](https://github.com/SaverioAzzato/dnd-pg-manager/releases/tag/prototype-v1) in git if you need it. See the [roadmap](docs/ROADMAP.md).

## Why

Existing tools lock your character behind their UI and account. Here the source of truth is a human- and GPT-readable `character.json` + an `images/` folder. You can edit it in the app, by hand, or with any external chatbot — no subscription, no lock-in. The same app ships everywhere: **web** (GitHub Pages), **desktop**, and **mobile**, all from one codebase.

## Quick start

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest unit tests
npm run typecheck  # tsc --noEmit
npm run build      # production web build
```

Requires Node 20+.

## Project structure

```
src/
  schema/        # Zod character schema (v2) + types, derived stats, v1→v2 migration, validation
  …              # model/ state/ storage/ render/ arrive in later milestones
docs/            # spec-first: ARCHITECTURE, SCHEMA, ROADMAP, AUTOMATION
characters/      # sample characters (also test fixtures); your real PGs go in pg/ (gitignored)
index.html       # Vite entry
```

## The `character.json` contract

A character is a folder: `character.json` + `images/`. The JSON is structured enough to validate rules and generate the UI, free enough for any class or homebrew (generic resources, custom sections, links and notes everywhere), and simple enough for an LLM to edit by hand. Full contract: **[docs/SCHEMA.md](docs/SCHEMA.md)**.

Rule of thumb: almost everything is **structural** (changes only on level-up/edit); a small enumerated set is **live** play-state (HP, resource `current`, item quantities, currencies, conditions). The UI only mutates the live fields continuously.

## GPT prompts (coming in M3)

The platform will ship four copy-ready prompts (base / create / level-up / validate) — in the README, [docs](docs/), and an in-app section — plus a published JSON Schema so any external chatbot knows exactly how to write the file.

## Content & licensing

By default, characters ship with `meta.ruleset: ["SRD"]` — the freely-licensed D&D 5e System Reference Document. Nothing in the schema, the prompts, or the `.github/agents/` seed material hardcodes a commercial sourcebook. You're free to point your own character (or chatbot session) at other guides — Xanathar's Guide to Everything, Tasha's Cauldron of Everything, third-party homebrew, etc. — *as an example* — but that's your own choice. **It's your responsibility to hold the rights/license to that material, to respect its license terms and any usage policy, and to use it responsibly and legally.** Neither this project nor its maintainers are responsible for misuse of copyrighted content by users.

## Distribution

Free and open: the **web app is the GitHub Pages site**; desktop and mobile binaries are attached to **GitHub Releases** (no app stores, no hosting bills). Built and shipped by GitHub Actions.

## Contributing & automation

- CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every PR.
- You can hand Claude a ticket and get a PR back — via [Claude Code on the web](https://claude.ai/code) (runs on Anthropic's cloud) or a local Claude Code session. See **[docs/AUTOMATION.md](docs/AUTOMATION.md)**.

## Docs

- [Architecture](docs/ARCHITECTURE.md) · [Schema](docs/SCHEMA.md) · [Roadmap](docs/ROADMAP.md) · [Automation](docs/AUTOMATION.md)
