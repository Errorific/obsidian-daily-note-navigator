# Claude Instructions

Project-specific guidance for AI agents working on the Daily Note Navigator
plugin. Global instructions in `~/.claude/CLAUDE.md` still apply.

## Read First

- [README.md](README.md) -- what this project is and why
- [ARCHITECTURE.md](ARCHITECTURE.md) -- high-level technical overview
- [CONTRIBUTING.md](CONTRIBUTING.md) -- repo layout, setup, workflow
- [AGENTS.md](AGENTS.md) -- detailed Obsidian plugin conventions (manifest
  rules, listener cleanup, mobile compatibility, security/privacy, release
  process). Treat this as authoritative for Obsidian plugin specifics.
- [docs/README.md](docs/README.md) -- routing for the `docs/` tree

## Documentation Conventions

This project uses the structure defined in [docs/README.md](docs/README.md).
Before creating or editing a doc, decide which of the five `docs/`
subdirectories it belongs in:

- `docs/user/` -- how to use the plugin
- `docs/development/` -- how to work on the plugin
- `docs/decisions/` -- ADRs. **Immutable once committed.** If a decision
  changes, write a new ADR that supersedes the old one and update the old
  ADR's `superseded_by` frontmatter (the one allowed edit to a committed ADR).
- `docs/research/` -- investigations and analysis; evergreen, updated in place
- `docs/design/` -- living specifications for *what* something should do (ADRs
  cover *why*)

When adding a doc to any of these, also add a one-line entry to that
directory's `README.md` index.

ADR filenames are `YYYY-MM-DD-short-description.md` (kebab-case). Use the
template in [docs/decisions/README.md](docs/decisions/README.md).

## Code Conventions

See [AGENTS.md](AGENTS.md). Key points:

- TypeScript with `strict: true`.
- Keep `main.ts` minimal -- lifecycle and command registration only.
- Split logic into focused modules under `src/`.
- Use Obsidian's `register*` helpers for any listener, interval, or DOM
  binding that needs cleanup on unload.
- Bundle everything into `main.js`. No unbundled runtime dependencies.

## Commit Conventions

- Plain, descriptive subject lines. No emoji.
- Subject in the imperative: "Add periodic note picker", not "Added...".
- Reference an ADR or design doc in the body when the change implements one.

## Issue Tracking

Not set up yet. When it is, record the location and conventions here.

## Scratch Files

Use `ai-tmp/` (gitignored globally) for any temporary scripts, planning
documents, or debugging artifacts. Do not commit them and do not add
`ai-tmp/` to the project's `.gitignore`.
