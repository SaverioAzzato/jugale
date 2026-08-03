# Claude Code guidance

Claude Code must follow [`AGENTS.md`](AGENTS.md) as the standing repository instructions and
[`docs/ENGINEERING.md`](docs/ENGINEERING.md) as the canonical development-quality guide. Read the
spec-first documents linked there before non-trivial work.

Tool-specific notes:

- Treat `.github/agents/*.agent.md` as historical end-user D&D prompt prototypes, not Claude Code
  subagents or development instructions.
- “Ticket → PR” may run in Claude Code on the web or locally; this repository intentionally has no
  API-billed `claude.yml`. See [`docs/AUTOMATION.md`](docs/AUTOMATION.md).
- Do not recreate the retired prototype. The React/Vite/Tauri application in the repository root is
  the shipped product; historical code is available from the `prototype-v1` tag only when needed.

Do not copy project versions, commands or architectural rules into this file. Their canonical
sources are `AGENTS.md`, `docs/ENGINEERING.md`, `docs/SCHEMA.md` and `package.json`, and automated
documentation checks guard those references against drift.
