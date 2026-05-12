# Contributing

How to work on the Daily Note Navigator plugin.

## Getting Oriented

- [README.md](README.md) -- product overview and motivation
- [ARCHITECTURE.md](ARCHITECTURE.md) -- high-level technical overview
- [AGENTS.md](AGENTS.md) -- detailed Obsidian plugin development conventions
- [docs/](docs/) -- extended documentation (design, decisions, research, dev, user)

## Repository Layout

| Location            | Purpose                                          |
|---------------------|--------------------------------------------------|
| `README.md`         | Product overview                                 |
| `ARCHITECTURE.md`   | High-level architecture                          |
| `CONTRIBUTING.md`   | Contributor guide (this file)                    |
| `CLAUDE.md`         | AI agent instructions                            |
| `AGENTS.md`         | Obsidian plugin development conventions          |
| `manifest.json`     | Plugin manifest (id, version, min app version)   |
| `versions.json`     | Map of plugin version -> minimum Obsidian version|
| `src/`              | TypeScript source                                |
| `styles.css`        | Plugin styles bundled with the release           |
| `esbuild.config.mjs`| Bundler configuration                            |
| `eslint.config.mts` | Lint configuration                               |
| `docs/`             | Extended documentation                           |
| `docs/decisions/`   | Architectural decision records                   |
| `docs/research/`    | Research and investigations                      |
| `docs/design/`      | Design specifications                            |
| `docs/development/` | Development guides                               |
| `docs/user/`        | User documentation                               |
| `ai-tmp/`           | Local-only scratch files (gitignored globally)   |

## Development Setup

### Prerequisites

- Node.js 18+ (current LTS)
- npm
- An Obsidian vault for testing

### First-Time Setup

```bash
npm install
```

To develop against a live vault, symlink or copy the build output into
`<Vault>/.obsidian/plugins/obsidian-daily-note-navigator/`. A symlink keeps the
plugin folder in sync with the working tree.

### Common Tasks

```bash
npm run dev      # esbuild in watch mode -- recompiles on save
npm run build    # production build
npm run lint     # eslint over src/
```

After a rebuild, reload Obsidian (Cmd/Ctrl+R in the developer console, or
disable/enable the plugin) to pick up changes.

## Workflow

- Work on a feature branch off `main`. Use short, descriptive branch names.
- Keep commits focused. Prefer small, reviewable changes over large
  drop-in PRs.
- Architectural decisions are recorded as ADRs in [`docs/decisions/`](docs/decisions/)
  before or alongside the implementation.
- Designs that span multiple changes live in [`docs/design/`](docs/design/) and
  are updated as the design evolves.

## Testing

There is no automated test harness yet. Until one is added:

- Manually exercise affected commands and UI in a real vault.
- Note specific manual test steps in the PR description for any non-trivial
  change.

When a test harness lands, document setup and conventions in
[`docs/development/`](docs/development/).

## Plugin-Specific Conventions

For Obsidian plugin specifics (manifest rules, mobile compatibility, listener
cleanup, security and privacy expectations, release process), see
[AGENTS.md](AGENTS.md). Those conventions apply to all contributors, not just
AI agents.
