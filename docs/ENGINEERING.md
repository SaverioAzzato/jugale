# Engineering guide

> Owner: repository maintainer · Last reviewed: 2026-08-03

This is the canonical operational guide for changing JUGALE. It defines how code should be shaped
and verified; it does not repeat the system topology in [ARCHITECTURE.md](ARCHITECTURE.md), the data
contract in [SCHEMA.md](SCHEMA.md), or release procedures in [AUTOMATION.md](AUTOMATION.md).

## Dependency direction and ownership

Dependencies point inward toward pure rules and explicit contracts:

```text
React UI / app hooks ─▶ state use cases ─▶ schema + model
         │                    │                 ▲
         └──────────────▶ storage ports ───────┘
                                  ▲
                    web / desktop / Android adapters
```

- `schema/` owns the JSON contract, migration, validation and derived character values. `model/`
  owns pure operations. Neither imports React, UI stores or host adapters.
- `state/` owns application transitions and persistence/version coordination. Non-deterministic
  services—clock, scheduler, RNG, dice presentation, notifications, settings and export—enter
  through explicit ports. `characterStore.ts` is the production composition root.
- `storage/` defines ports and host adapters. Adapters translate browser, Tauri and SAF behavior;
  they do not decide domain rules.
- `app/`, `render/` and `ui/` orchestrate use cases and presentation. Components may select and
  dispatch state, but must not reimplement validation, derivation or persistence policy.
- A new dependency in the opposite direction is a design decision, not a convenient shortcut.
  Resolve it with a smaller interface or move the rule to its owning layer.

## Focused responsibilities without ceremony

Apply SOLID and KISS as review questions, not as quotas:

- Prefer a focused module with one reason to change and composition over a growing coordinator.
- Introduce an abstraction when it removes semantic duplication across real implementations or
  makes a side-effect boundary testable. Do not create interfaces for hypothetical variants.
- Extract pure decisions from I/O-heavy code; keep thin wiring close to its caller.
- Avoid both monoliths and one-line wrapper forests. A module should own a rule, a use case, an
  adapter boundary or a reusable presentation concept.
- Preserve the existing straightforward solution unless measurement, repeated drift or test pain
  demonstrates a concrete problem.

## Typed, lossless data

- Treat data from files, IndexedDB, native plugins, shares and JSON editors as `unknown` until the
  relevant boundary validates it.
- Use discriminated unions for real variants and state machines. Prefer types that make dangerous
  states unrepresentable—for example, only validated current-schema drafts can produce a
  `PersistableCharacterDocument`.
- Avoid casts and non-null assertions in the core. At native or third-party boundaries, keep any
  unavoidable narrowing local, validate first and explain the boundary.
- Match errors by typed code, not message text. Preserve the original error as `cause` when useful.
- The source document and editable draft are lossless JSON values. Unknown top-level and nested
  keys survive load, edit, save and reload. Rendering defaults belong only to the projection.

The normative source/draft/projection/persistable state model and write policy are in
[ADR 0001](decisions/0001-lossless-character-document.md); field semantics and schema evolution are
in [SCHEMA.md](SCHEMA.md).

## Persistence and failure policy

- Fail closed before canonical writes, replacements and snapshots. A schema-invalid or
  future-schema draft may be rendered or explicitly exported for recovery, but never silently
  overwrite the bound `character.json`.
- Distinguish validation, domain, not-found, permission and I/O failures. Recovery UI must reflect
  the actual failure rather than infer it from prose.
- Serialize writes and flush pending play edits before snapshots or whole-document replacement.
- Atomicity is host-specific. Desktop folder writes use a sibling temporary file and rename;
  browser File System Access and Android SAF expose weaker commits. Keep those guarantees explicit
  in [ARCHITECTURE.md](ARCHITECTURE.md), and never claim a stronger guarantee than the adapter has.
- Optional metadata cannot redefine the success of authoritative content. A version sidecar
  failure, for example, must not turn a successful snapshot write into a false content failure.

## Testing strategy

- Put unit tests around pure schema/model decisions and state transitions.
- Run the shared contract suite for behavior that every storage/version adapter must implement;
  use adapter integration tests for host translation.
- Cover user-visible critical flows with Playwright. Pure Kotlin plugin rules run as JVM unit tests;
  browser E2E does not substitute for native compilation, merged-manifest checks or real-device
  SAF/share tests.
- Inject clocks, schedulers and RNG. Use fake timers for debounce; do not make tests wait for real
  300–350 ms delays or depend on incidental implementation details.
- Add a regression test that demonstrates a bug before fixing it whenever practical. Assert the
  behavior and preserved data, not private call ordering.
- Keep test scope proportional to risk: schema, migration, persistence, share and replacement
  changes require round-trip/failure coverage; visual changes require focused component checks and
  screenshots where the Help contract requires them.

Thresholds, browser projects, bundle budgets and native gates are specified in
[AUTOMATION.md](AUTOMATION.md).

## Change checklists

For schema changes, follow the complete cross-surface checklist in
[SCHEMA.md §6](SCHEMA.md#6-changing-the-schema). For any change, confirm:

- the owning layer contains the rule and no inverse dependency or duplicate contract was added;
- external `unknown` input is validated and error cases fail safely;
- tests cover the new behavior and the important failure/round-trip paths;
- EN/IT, Help assets/content and specialist documentation changed when behavior or contract did;
- host compatibility was considered for web, desktop and Android;
- dependency changes include regenerated and reviewed legal artifacts;
- performance changes include before/after minified and gzip measurements.

## Definition of Done

A change is done when:

1. `npm run check` passes with zero lint warnings, thresholded coverage, production build and bundle
   budget.
2. `npm run test:e2e` passes when a critical user flow changed; `cargo check --locked` and the
   relevant Android build/device checks pass when native code or contracts changed.
3. Tests are deterministic and proportionate to the data-loss, host and user-visible risk.
4. Documentation, EN/IT and agent-facing memory describe the implemented state, not a plan.
5. No render fallback became persistable, no unknown JSON key is silently discarded, and no
   platform received an unreviewed weaker safety guarantee.
6. Performance-sensitive work records its baseline, result, produced chunks and startup impact.

Facts that can drift mechanically are checked by `npm run check:docs`; the engineering principles
remain a human review responsibility of the repository maintainer on every material architecture
change. Update the review date above when that review occurs.
