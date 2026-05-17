# CLI Surface

The `daily-note-navigator:*` Obsidian CLI subcommands exposed by this plugin. These are the
programmatic surface that LLMs, scripts, and power users invoke to navigate
the journal.

References:

- [Folder layout and date-to-path mapping](folder-layout.md) -- the pure
  function every subcommand below dispatches through.
- [Obsidian CLI extension API](../research/cli-extension-api.md) -- contract
  for `Plugin.registerCliHandler`, including how boolean flags arrive
  (`'true'` literal in the params record) and the stdout-as-return-string
  convention.

## Design principles

- **One vocabulary.** Every subcommand uses the same selector parameters
  (`period`, `date`, `ref`) and the same period set. No exceptions.
- **Pure resolution is free.** `daily-note-navigator:path` does no I/O and never creates a
  file. Subcommands that touch the vault do so explicitly.
- **Idempotent creation.** Creating a note that already exists is not an
  error. Callers can ask for the path and the existence flag back.
- **Predictable output.** Default output is the resolved path on its own
  line, so the typical pipeline `obsidian daily-note-navigator:path date=today period=daily`
  is a path-emitting command. Structured callers ask for `format=json`.
- **Errors as content.** The CLI handler contract is "return a string to
  stdout". We return `Error: <message>` in text mode and
  `{"ok":false,"error":"<message>"}` in JSON mode, matching the convention
  Templater established.

## Selector parameters

All `daily-note-navigator:*` subcommands accept the same set of selectors:

| Flag       | Type   | Purpose                                                  |
|------------|--------|----------------------------------------------------------|
| `period`   | enum   | `daily` / `weekly` / `quarterly` / `yearly`. Required.  |
| `date`     | string | ISO date `YYYY-MM-DD`. Mutually exclusive with `ref`.   |
| `ref`      | string | Human reference -- `2026/W20`, `2026/Q2`, `2026`.       |
| `format`   | enum   | `text` (default) or `json`.                              |

If neither `date` nor `ref` is given, the subcommand uses **today's local
date** as the anchor. This is the common case for "open today's daily" and
removes the need for a separate `daily-note-navigator:today` subcommand.

`ref` strings are parsed per the period:

| Period    | Accepted ref format       | Notes                                  |
|-----------|---------------------------|----------------------------------------|
| daily     | `YYYY-MM-DD`              | Same as `date`. `ref` is redundant here. |
| weekly    | `YYYY/W{ww}` or `YYYY-W{ww}` | `W01`-`W53`; leading zero optional.   |
| quarterly | `YYYY/Q{q}` or `YYYY-Q{q}`| `Q1`-`Q4`.                              |
| yearly    | `YYYY`                    | Four-digit year.                       |

Mismatched ref/period (e.g. `period=weekly ref=2026/Q2`) returns an error.

## Subcommands

### `daily-note-navigator:path`

Resolve the path of a periodic note. **Does not touch the vault.**

| Flag       | Required | Description                                                                            |
|------------|----------|----------------------------------------------------------------------------------------|
| `period`   | yes      | See selectors.                                                                         |
| `date`     | no       | See selectors. Defaults to today if `ref` is also omitted.                             |
| `ref`      | no       | See selectors.                                                                         |
| `format`   | no       | `text` / `json`. Default `text`.                                                       |

Output (text):

```
Journal/2026/Q2/W20/2026-05-11 Monday.md
```

Output (JSON):

```json
{"ok": true, "path": "Journal/2026/Q2/W20/2026-05-11 Monday.md"}
```

Use cases: "where would this note live?", input for downstream tools that
will read or create the file themselves.

### `daily-note-navigator:exists`

Resolve the path and check whether the file exists in the vault. **Read-only.**

| Flag       | Required | Description                                                                            |
|------------|----------|----------------------------------------------------------------------------------------|
| `period`   | yes      |                                                                                        |
| `date`     | no       |                                                                                        |
| `ref`      | no       |                                                                                        |
| `format`   | no       | `text` / `json`. Default `text`.                                                       |

Output (text), one of:

```
exists: Journal/2026/Q2/W20/2026-05-11 Monday.md
missing: Journal/2026/Q2/W20/2026-05-11 Monday.md
```

Output (JSON):

```json
{"ok": true, "path": "Journal/2026/Q2/W20/2026-05-11 Monday.md", "exists": true}
```

The text form puts the status first so simple consumers can match on it
without parsing. Both forms always include the path so the caller knows
where the file would go even when missing.

### `daily-note-navigator:find`

The "find or create" workhorse. Resolves the path, checks existence, and
optionally creates and/or opens the note.

| Flag       | Required | Description                                                                            |
|------------|----------|----------------------------------------------------------------------------------------|
| `period`   | yes      |                                                                                        |
| `date`     | no       |                                                                                        |
| `ref`      | no       |                                                                                        |
| `create`   | no       | If set and the note is missing, create it (using the configured template).             |
| `template` | no       | Override the configured template for this creation. Path relative to vault root.       |
| `open`     | no       | After resolving (and optionally creating), open the note in the UI.                    |
| `newtab`   | no       | Only meaningful with `open`. Opens in a new tab.                                       |
| `format`   | no       | `text` / `json`. Default `text`.                                                       |

Output (text), one of:

```
existed: Journal/2026/Q2/W20/2026-05-11 Monday.md
created: Journal/2026/Q2/W20/2026-05-11 Monday.md
missing: Journal/2026/Q2/W20/2026-05-11 Monday.md     # when create was not set
```

Output (JSON):

```json
{"ok": true,
 "path": "Journal/2026/Q2/W20/2026-05-11 Monday.md",
 "existed": false, "created": true, "opened": true}
```

`existed` reflects the state **before** the subcommand ran. `created` is
true only if this invocation wrote the file. These flags are independent
in the JSON output.

When `create` is set and the template fails to apply (missing template
file, Templater error), creation is aborted and the error is returned --
the note is not left half-written. See the templates design doc for the
exact failure semantics.

### `daily-note-navigator:list` (deferred)

Listing all notes of a given period is potentially useful ("show me every
quarterly note") but isn't on the v1 requirements list and the same query
can be done with the built-in `obsidian files folder=Journal`. Deferred.

## Default-template behaviour

`daily-note-navigator:find create` (and a future `daily-note-navigator:create`, if added) uses the
configured template for the period. If no template is configured and no
`template=` flag is given, the note is created empty.

If Templater is installed, the template content is processed through
Templater. If not, the template file is copied verbatim. This is described
in detail in the templates design doc.

## Error handling

Returned error strings (text mode) are formatted as `Error: <message>`,
matching the Templater pattern. JSON mode returns
`{"ok": false, "error": "<message>"}`. Examples:

- Invalid period: `Error: unknown period 'foo' (expected daily, weekly, quarterly, yearly)`
- Invalid ref for period: `Error: ref '2026/Q2' is not valid for period 'weekly'`
- Template not found: `Error: template 'Templates/Daily.md' not found`
- Templater failure: `Error: Templater: <Templater's own error message>`

The Obsidian CLI itself surfaces these via stdout; exit-code semantics
aren't part of the registerCliHandler contract.

## Worked examples

```bash
# Today's daily, just give me the path
obsidian daily-note-navigator:path period=daily

# Where will this Friday's daily live?
obsidian daily-note-navigator:path period=daily date=2026-05-15

# Is this week's weekly note started yet?
obsidian daily-note-navigator:exists period=weekly

# Open Q2's quarterly note, creating it if missing
obsidian daily-note-navigator:find period=quarterly ref=2026/Q2 create open

# JSON output for an LLM:
obsidian daily-note-navigator:find period=daily date=2026-05-11 create format=json

# Find the daily for a specific date by ISO ref (same as date= here)
obsidian daily-note-navigator:path period=daily ref=2026-05-11
```

## Open questions

- **`daily-note-navigator:open` as a separate subcommand?** Right now `open` is a flag on
  `daily-note-navigator:find`. It might be more discoverable as its own subcommand mirroring
  the existing `daily` / `open` / `tab:open` set. Deferred until we see how
  it gets used.
- **Should we accept `date=today`?** The built-in CLI uses `today`-style
  shortcuts in some places. Our default-to-today behaviour covers the same
  ground. Decline unless we see a real reason to add it.
