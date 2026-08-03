# Contributing to :JUGALE

Thanks for taking a look. JUGALE is a personal, deliberately opinionated project rather than a community roadmap or a product maintained by a team. A clear, narrowly scoped contribution is much easier to understand and review, so please read this before opening a PR.

## Read first

- [`docs/ENGINEERING.md`](docs/ENGINEERING.md) — dependency direction, persistence safety,
  testability and the Definition of Done.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app is structured, the `StorageProvider` abstraction, the one-web-front-end-three-hosts design.
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — the `character.json` v2 contract. This is the thing the whole app serves; changes here ripple everywhere.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's done, what's in flight, what's deliberately out of scope.
- [`AGENTS.md`](AGENTS.md) — the standing project rules (also followed by AI-assisted development; see [`docs/AUTOMATION.md`](docs/AUTOMATION.md)).

## Setup

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest unit tests
npm run test:coverage # blocking global and critical-area thresholds
npm run test:e2e   # Playwright desktop/mobile Chromium flows
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint, zero warnings allowed
npm run build      # production web build + entry bundle budget
npm run check:docs # documentation/schema/command/link drift
npm run check      # complete local web gate
npm run check:ci   # local web gate + Playwright
npm run legal:generate # refresh notices/SBOM after a lockfile change
npm run check:release # clean install + full gate + locked Rust check
```

Node 20.19+.

## Product invariants

- **`character.json` is the single source of truth.** Never hardcode character- or class-specific
  content into the UI.
- **Persist inputs, not derived outputs.** Preserve unknown keys and keep source/draft separate from
  the render projection. Only a validated, supported draft may overwrite canonical JSON; see the
  lossless policy in Engineering and [ADR 0001](docs/decisions/0001-lossless-character-document.md).
- **Respect structural versus live state.** Current/temp HP, remaining Hit Dice, resource current,
  item quantity/equipped state, currencies and session fields are live; other fields require an
  explicit edit.
- **Keep licensing risk low.** `meta.ruleset` defaults to `["SRD 5.1"]`, the CC-BY-4.0-licensed 2014 rules. SRD 5.2.1 is a different revised rules line and must be named explicitly; don't use the ambiguous bare label `"SRD"`. Don't hardcode a commercial sourcebook (PHB, Xanathar, Tasha's, third-party content, etc.) into schema defaults, prompts, `.github/agents/`, or docs as anything other than a clearly labelled, README-only example.
- **No in-app chat/LLM.** Deliberately out of scope — see the "Explicitly out of scope" section of the roadmap. External chatbots driven by the published JSON Schema are the supported integration point.

## Tests

Use unit tests for pure rules/state, the shared contract suite for storage/version adapters, focused
component tests for presentation, and Playwright for critical user flows. CI runs documentation
checks, zero-warning lint, typecheck, thresholded coverage, build/bundle budget and Playwright on
every PR. Native changes also receive path-filtered Rust or Android builds. Follow the risk-based
strategy in [Engineering](docs/ENGINEERING.md#testing-strategy).

## PR checklist

- [ ] The change has one clear problem and outcome; unrelated cleanup is excluded.
- [ ] Types validate external boundaries and do not introduce avoidable casts, non-null assertions
      or message-string error matching.
- [ ] Tests cover the behavior and important failure, lossless round-trip and host cases.
- [ ] `npm run check` passes; E2E and native checks were run when their flows changed.
- [ ] EN/IT, Help, schema/architecture docs and `docs/ENGINEERING.md` were updated where relevant.
- [ ] Web, desktop and Android compatibility was considered explicitly.
- [ ] Performance work includes before/after minified and gzip measurements.
- [ ] Dependency changes include regenerated legal artifacts and a manual licence review.

## Sending a change

- Give the PR one clearly defined problem and outcome. Explain why the change belongs in JUGALE, what is deliberately out of scope, the important decisions or trade-offs, and how you validated it; include before/after screenshots for visible UI work.
- Keep the implementation simple and the diff easy to review. Avoid unrelated cleanup or drive-by refactors, and split independent changes into separate PRs.
- For a large feature, schema change, new dependency, or shift in product direction, open a focused issue before investing heavily so the approach can be discussed.
- If you're touching `src/schema/`, follow the complete checklist in
  [`docs/SCHEMA.md`](docs/SCHEMA.md#6-changing-the-schema).
- If a JavaScript or Rust dependency changes, run `npm run legal:generate`, review the new licence/source entries, and commit both generated files. CI rejects a notice/SBOM whose lockfile fingerprint or component list is stale, but it cannot decide whether a new licence is acceptable; stop on `NOASSERTION`, missing expected notices, proprietary terms or unexpected copyleft until the obligations are understood.
- If you're shipping a UI feature beyond what's already scoped in the roadmap, add a line to the relevant milestone in `docs/ROADMAP.md` once it ships.

This project is maintained in personal time. Opening an issue or PR does not create a promise or timeline for a reply, review, merge, or release; a response may be delayed, and I may not be able to respond to every proposal.
