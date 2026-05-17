# Command Palette Surface

The Obsidian commands this plugin registers via `Plugin.addCommand`. These
are the human-facing surface -- discoverable through the command palette
(Cmd-P / Ctrl-P), hotkey-bindable, and reachable from the Obsidian CLI's
generic `obsidian command id=<id>` subcommand.

References:

- [CLI surface](cli-surface.md) -- the richer parameterised surface that
  exists in parallel.
- [Folder layout](folder-layout.md) -- everything below dispatches through
  the same pure resolver.

## Why both commands and a CLI surface?

Obsidian commands can't take parameters. They're a fixed list of
{id, action} pairs. That's fine for "open today's daily" -- there's no
parameter -- but it doesn't support "open the daily for an arbitrary date"
without either (a) registering a parameterised command (impossible),
(b) prompting via a modal (possible but slow for an LLM), or (c) using the
CLI subcommands (the LLM path).

So the split is:

- **Command palette**: fixed-shape actions a human picks by name. Designed
  for keyboard ergonomics.
- **CLI**: parameterised actions a script or LLM invokes. Designed for
  composability.

There is overlap, on purpose: opening today's daily is convenient from both
surfaces. The command palette command and the CLI subcommand call the same
underlying function.

## Command IDs and naming

Plugin ID is `daily-note-navigator`. Obsidian prefixes the registered ID
with the plugin ID automatically, so the user-visible IDs are e.g.
`daily-note-navigator:open-today`.

Display names use sentence case, per the Obsidian style guide:

- "Open today's daily note" -- not "Open Today's Daily Note"
- "Open this week's weekly note"
- "Create today's daily note from template"

## v1 command set

| ID                       | Display name                              | Action                                                                                |
|--------------------------|-------------------------------------------|---------------------------------------------------------------------------------------|
| `open-today`             | Open today's daily note                   | Resolve daily for today. If missing, create with template. Open in current tab.       |
| `open-this-week`         | Open this week's weekly note              | Same, weekly, for the ISO week containing today.                                      |
| `open-this-quarter`      | Open this quarter's quarterly note        | Same, quarterly.                                                                      |
| `open-this-year`         | Open this year's yearly note              | Same, yearly.                                                                         |
| `open-previous`          | Open previous note (for current period)   | If the active file is a periodic note, open the previous one of that period.          |
| `open-next`              | Open next note (for current period)       | Symmetric to previous.                                                                |
| `pick-date`              | Open daily note for date...               | Prompts for a date (modal), then opens that daily, creating if needed.                |
| `pick-period-note`       | Open periodic note...                     | Modal: choose period + date/ref, then open. Useful when bindings get cluttered.       |

This is the minimal set that covers:

- The four "open today/this {period}" affordances (one per period).
- Sequence navigation: previous / next within the current period. Treats
  the date math as a pure function: previous-of(2026-05-11, daily) =
  2026-05-10; previous-of(2026/W20, weekly) = 2026/W19; etc.
- Arbitrary date selection via a modal, for cases where the period
  shortcuts don't apply.

Hotkey defaults: none. Users assign their own in Settings -> Hotkeys.
Setting defaults invites conflicts with other plugins.

## Behaviour shared across "open" commands

All "open X" commands follow the same recipe:

1. Compute the anchor date (today, or as prompted).
2. Resolve folder + filename via the pure resolver.
3. If the file exists, open it (current tab, unless modifier keys override).
4. If it doesn't exist:
   - Apply the configured template for the period (Templater-processed if
     Templater is available; verbatim copy otherwise).
   - Create the file with the resulting content.
   - Open it.
5. If template application fails, abort step 4 with a user notice; do not
   create a half-written file.

This is the same flow the CLI's `daily-note-navigator:find create open` invokes -- the
command palette commands are thin wrappers over it.

## Previous / next semantics

For "open previous note" of the current period:

- The active file must be a periodic note of some recognised period --
  recognised by the resolver pattern (folder shape + filename pattern).
- The previous unit is the one whose anchor is one period earlier:
  - daily: previous calendar day.
  - weekly: previous ISO week.
  - quarterly: previous calendar quarter.
  - yearly: previous ISO week-year.
- The target note may or may not exist. The command opens it, creating
  with template if missing (same recipe as the "open today" commands).

If the active file is not a periodic note, the command shows a notice and
does nothing.

## Things explicitly **not** registered as commands

- "Path of today's daily" -- this is a CLI-only concern. A command palette
  entry that prints to a notice is not useful.
- "Does this week's weekly exist?" -- same; pure resolution is a CLI thing.
- "Create without opening" -- handled by the CLI; bloats the command
  palette without value.

The principle: command palette is for **actions a human takes on a note**.
Pure lookups stay in the CLI.

## CLI parity

Every "open" command palette command has a CLI equivalent (`daily-note-navigator:find
period=... create open`). The reverse isn't true -- the CLI's `daily-note-navigator:path`
and `daily-note-navigator:exists` don't appear in the command palette. This matches the
principle above.

## Open questions

- **"Open daily for date" via a fuzzy date picker?** Worth a usability
  pass once the basics are working. The Obsidian native date picker is
  date-only; for weekly/quarterly we'd want a richer chooser. Out of scope
  for v1.
