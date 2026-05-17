# Obsidian CLI Extension API

How plugins extend the Obsidian CLI (`obsidian <command> [options]`) with
their own subcommands. This was added in Obsidian **1.12.2** and is not yet
covered by the public docs site, so this research records the contract from
the type definitions and from the Templater / QuickAdd implementations.

## API

From `obsidian.d.ts` (1.12.2):

```ts
interface CliData {
  [key: string]: string | 'true';
}

interface CliFlag {
  // Value placeholder shown in help (e.g. '<path>'). Omit for boolean flags.
  value?: string;
  description: string;
  // Default false.
  required?: boolean;
}

type CliFlags = Record<string, CliFlag>;

type CliHandler = (params: CliData) => string | Promise<string>;

// On Plugin:
registerCliHandler(
  command: string,
  description: string,
  flags: CliFlags | null,
  handler: CliHandler,
): void;
```

Key contract points:

- The handler's returned string is written to stdout.
- Boolean flags arrive as the literal string `'true'` when present, absent
  from the record when not. The TS type already encodes this.
- `flags` may be `null` for subcommands that take no parameters.
- Command IDs must be globally unique. Subcommand IDs commonly use the
  format `<namespace>:<action>` (see below).

## Namespace convention

The `registerCliHandler` docstring says:

> Use the format `<plugin-id>` for your default command, and
> `<plugin-id>:<action>` for sub-commands and actions.

In practice this is **not enforced** by Obsidian. Templater's plugin id is
`templater-obsidian` but its CLI namespace is `templater:`. QuickAdd's
plugin id is `quickadd` and its namespace matches.

This means we can pick a short namespace independent of the plugin id. The
intent is just that two plugins shouldn't collide.

## Patterns observed in the wild

### Templater (`src/handlers/CommandHandler.ts`)

Single subcommand, registered once from the plugin's command-registration
path:

```ts
this.plugin.registerCliHandler(
  "templater:create-from-template",
  "Create a new note from a Templater template",
  {
    template: { value: "<path>", description: "...", required: true },
    file:     { value: "<path>", description: "...", required: true },
    open:     { description: "Open the created file in the UI", required: false },
  },
  async (params) => this.handle_create_from_template(params),
);
```

Returns the resulting file path on success, `"Error: ..."` string on failure
(the CLI surfaces both via stdout; exit-code semantics aren't part of the
contract).

### QuickAdd (`src/cli/registerQuickAddCliHandlers.ts`)

Multiple subcommands; flag schemas are defined as module-level constants
(`RUN_FLAGS`, `LIST_FLAGS`, `CHECK_FLAGS`) and reused. The plugin also
**guards the call** against older Obsidian versions:

```ts
interface RegisterCliHandlerTarget {
  registerCliHandler?: (
    command: string,
    description: string,
    flags: CliFlags | null,
    handler: (params: CliData) => string | Promise<string>,
  ) => void;
}
```

QuickAdd returns structured JSON-stringified responses (`{ ok, command, ... }`)
from its handlers, which is useful for programmatic consumers (LLMs, scripts).

## Implications for this plugin

- **`minAppVersion` must be at least 1.12.2** in `manifest.json`. The
  template's 0.15.0 is wrong for our needs.
- **No defensive guard needed.** Because we're requiring 1.12.2+, we can
  call `registerCliHandler` unconditionally rather than copying QuickAdd's
  optional-method pattern.
- **Return structured strings.** QuickAdd's JSON-response pattern is a good
  fit for the LLM-driven workflows on the requirements list. For simple
  path-lookup subcommands a plain path string is probably sufficient and
  more shell-pipeline-friendly. The design doc for the CLI surface will
  pick per-subcommand.
- **CLI namespace.** We use `daily-note-navigator:`, matching the plugin id
  and consistent with Templater's `templater:` and QuickAdd's `quickadd:`.
  The full id is self-documenting in shell history and scripts, and tab
  completion makes the typing cost negligible.

## Related Obsidian CLI subcommands worth knowing

These already exist and we'll likely invoke or coexist with them:

- `command id=<id>` -- run any registered Obsidian command (the command
  palette set, which our plugin's `addCommand` calls also feed into).
- `templater:create-from-template template=<path> file=<path>` -- our
  Templater integration may call this internally, though calling the
  Templater plugin API directly is also an option.
- `daily*` -- the core daily-notes CLI surface. Conflicts with our plugin if
  the core daily-notes plugin is enabled. We expect users to disable core
  daily; we will not register anything in the `daily:` namespace.
