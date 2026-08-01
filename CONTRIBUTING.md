# Contributing to :JUGALE

Thanks for taking a look. JUGALE is a personal, deliberately opinionated project rather than a community roadmap or a product maintained by a team. A clear, narrowly scoped contribution is much easier to understand and review, so please read this before opening a PR.

## Read first

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app is structured, the `StorageProvider` abstraction, the one-web-front-end-three-hosts design.
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — the `character.json` v2 contract. This is the thing the whole app serves; changes here ripple everywhere.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's done, what's in flight, what's deliberately out of scope.
- [`AGENTS.md`](AGENTS.md) — the standing project rules (also followed by AI-assisted development; see [`docs/AUTOMATION.md`](docs/AUTOMATION.md)).

## Setup

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest unit tests
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production web build
npm run check      # versions + lint + typecheck + tests + web build
npm run legal:generate # refresh notices/SBOM after a lockfile change
npm run check:release # clean install + full gate + locked Rust check
```

Node 20.19+.

## Ground rules

- **`character.json` is the single source of truth.** The app is a stateless, data-driven renderer/editor over it. Never hardcode character- or class-specific content into the UI — it has to come from the JSON, or it doesn't belong.
- **Inputs, not outputs.** The schema (`src/schema/character.ts`) stores raw inputs; ability modifiers, proficiency bonus, save DCs, total level, etc. are *derived* (`src/schema/derive.ts`), never required fields.
- **Structural vs. live state.** Only a small, enumerated set of fields are live play-state the UI mutates continuously (HP, resource `current`, item quantities, currencies, session state). Everything else is structural and should only change on an explicit edit.
- **Preserve unknown fields.** The schema is `.passthrough()` everywhere on purpose — a half-edited or hand-authored file should never get silently stripped or lock the app out. `loadCharacter()` never throws; schema problems become `warning`/`error` issues, not a crash.
- **Keep licensing risk low.** `meta.ruleset` defaults to `["SRD 5.1"]`, the CC-BY-4.0-licensed 2014 rules. SRD 5.2.1 is a different revised rules line and must be named explicitly; don't use the ambiguous bare label `"SRD"`. Don't hardcode a commercial sourcebook (PHB, Xanathar, Tasha's, third-party content, etc.) into schema defaults, prompts, `.github/agents/`, or docs as anything other than a clearly labelled, README-only example.
- **No in-app chat/LLM.** Deliberately out of scope — see the "Explicitly out of scope" section of the roadmap. External chatbots driven by the published JSON Schema are the supported integration point.

## Tests

The schema/derivation/migration layer is exhaustively unit-tested (`*.test.ts` next to source, Vitest) — CI runs typecheck + tests + build on every PR and has to stay green. Add or update tests with any schema, derivation, or migration change.

## Sending a change

- Give the PR one clearly defined problem and outcome. Explain why the change belongs in JUGALE, what is deliberately out of scope, the important decisions or trade-offs, and how you validated it; include before/after screenshots for visible UI work.
- Keep the implementation simple and the diff easy to review. Avoid unrelated cleanup or drive-by refactors, and split independent changes into separate PRs.
- For a large feature, schema change, new dependency, or shift in product direction, open a focused issue before investing heavily so the approach can be discussed.
- If you're touching `src/schema/`, also check whether `docs/SCHEMA.md` needs updating to match.
- If a JavaScript or Rust dependency changes, run `npm run legal:generate`, review the new licence/source entries, and commit both generated files. CI rejects a notice/SBOM whose lockfile fingerprint or component list is stale.
- If you're shipping a UI feature beyond what's already scoped in the roadmap, add a line to the relevant milestone in `docs/ROADMAP.md` once it ships.

This project is maintained in personal time. Opening an issue or PR does not create a promise or timeline for a reply, review, merge, or release; a response may be delayed, and I may not be able to respond to every proposal.
