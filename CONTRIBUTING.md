# Contributing to :JUGALE

Thanks for taking a look. This is a small, opinionated project — read this before sending a PR so your change lands cleanly.

## Read first

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app is structured, the `StorageProvider` abstraction, the one-web-front-end-three-hosts design.
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — the `character.json` v2 contract. This is the thing the whole app serves; changes here ripple everywhere.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's done, what's in flight, what's deliberately out of scope.
- [`CLAUDE.md`](CLAUDE.md) — the standing project rules (also followed by the AI-assisted "ticket → PR" automation, see [`docs/AUTOMATION.md`](docs/AUTOMATION.md)).

## Setup

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest unit tests
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production web build
```

Node 20+.

## Ground rules

- **`character.json` is the single source of truth.** The app is a stateless, data-driven renderer/editor over it. Never hardcode character- or class-specific content into the UI — it has to come from the JSON, or it doesn't belong.
- **Inputs, not outputs.** The schema (`src/schema/character.ts`) stores raw inputs; ability modifiers, proficiency bonus, save DCs, total level, etc. are *derived* (`src/schema/derive.ts`), never required fields.
- **Structural vs. live state.** Only a small, enumerated set of fields are live play-state the UI mutates continuously (HP, resource `current`, item quantities, currencies, session state). Everything else is structural and should only change on an explicit edit.
- **Preserve unknown fields.** The schema is `.passthrough()` everywhere on purpose — a half-edited or hand-authored file should never get silently stripped or lock the app out. `loadCharacter()` never throws; schema problems become `warning`/`error` issues, not a crash.
- **Keep licensing risk low.** `meta.ruleset` defaults to `["SRD"]`. Don't hardcode a commercial sourcebook (PHB, Xanathar, Tasha's, third-party content, etc.) into schema defaults, prompts, `.github/agents/`, or docs as anything other than a clearly-labeled, README-only example.
- **No in-app chat/LLM.** Deliberately out of scope — see the "Explicitly out of scope" section of the roadmap. External chatbots driven by the published JSON Schema are the supported integration point.

## Tests

The schema/derivation/migration layer is exhaustively unit-tested (`*.test.ts` next to source, Vitest) — CI runs typecheck + tests + build on every PR and has to stay green. Add or update tests with any schema, derivation, or migration change.

## Sending a change

- Small, focused PRs over big ones — easier to review against the rules above.
- If you're touching `src/schema/`, also check whether `docs/SCHEMA.md` needs updating to match.
- If you're shipping a UI feature beyond what's already scoped in the roadmap, add a line to the relevant milestone in `docs/ROADMAP.md` once it ships.
