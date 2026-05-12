# Architecture

High-level technical overview of the Daily Note Navigator plugin. For product
context, see [README.md](README.md). For contributor setup, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Bird's Eye View

The plugin is an Obsidian community plugin written in TypeScript and bundled to
a single `main.js` by esbuild. At runtime it loads inside the Obsidian app
process, registers commands and (likely) UI surfaces, and interacts with the
vault through the Obsidian API.

```
+-------------------+        +-----------------------+        +----------------+
|   Obsidian app    | <----> |  Daily Note Navigator | <----> |  Vault files   |
| (commands, UI,    |        |  plugin (main.js)     |        |  (daily notes, |
|  workspace, API)  |        |                       |        |   folders)     |
+-------------------+        +-----------------------+        +----------------+
```

Detailed design is still in flight. As modules are introduced, document them in
the Code Map below by symbol name (not file path).

## Code Map

The plugin currently contains only the Obsidian sample plugin scaffolding:

- `MyPlugin` -- plugin entry class extending Obsidian's `Plugin`. Owns
  lifecycle hooks (`onload`, `onunload`) and command registration.
- `MyPluginSettings` / `DEFAULT_SETTINGS` -- settings interface and defaults
  loaded via `loadData` / `saveData`.

Real modules will be added as design docs in [`docs/design/`](docs/design/)
land.

## Architectural Invariants

- **Single bundled artifact.** All runtime code ships in `main.js`. No
  unbundled runtime dependencies.
- **Vault scope only.** The plugin reads and writes only within the user's
  vault, via the Obsidian API.
- **Offline by default.** No network calls unless an explicit feature requires
  them, with disclosure and opt-in.
- **Safe unload.** All listeners, intervals, and DOM bindings are registered
  via Obsidian's `register*` helpers so they clean up on plugin reload.

## Cross-Cutting Concerns

- **Settings persistence.** Settings flow through `Plugin.loadData` /
  `Plugin.saveData`; defaults are merged on load.
- **Mobile compatibility.** Avoid desktop-only APIs unless `isDesktopOnly` is
  set in `manifest.json`.
- **Obsidian API surface.** Periodic notes integrations may rely on the
  community Periodic Notes plugin's API; that dependency, if taken, will be
  recorded as an ADR.
