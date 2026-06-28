# Scripting API

The in-process API the plugin exposes on its instance for other plugins and
user scripts running inside Obsidian's renderer (e.g. a QuickAdd or Templater
user script). This is the in-renderer counterpart to the
[CLI surface](cli-surface.md): the CLI serves the external `obsidian` command,
while this API serves code already running in the app.

References:

- [Folder layout and date-to-path mapping](folder-layout.md) -- the pure
  function the API dispatches through.
- [ISO-week period boundaries](../decisions/2026-05-11-iso-week-period-boundaries.md)
  -- the Thursday rule that makes a date-format string unable to reproduce the
  plugin's paths, which is why a callable API exists.

## Reaching the API

Obsidian exposes every enabled plugin's instance at
`app.plugins.plugins[<id>]`. This plugin's id is `daily-note-navigator`:

```js
const plugin = app.plugins.plugins["daily-note-navigator"];
```

A caller must guard for the plugin being absent or disabled before using it.

## `resolvePath(period?, anchor?)`

Resolves the vault path of a periodic note. **Does no I/O and never creates a
file** -- it is the in-process equivalent of `daily-note-navigator:path`.

| Parameter | Type     | Default      | Description                                             |
|-----------|----------|--------------|---------------------------------------------------------|
| `period`  | `Period` | `"daily"`    | `daily` / `weekly` / `quarterly` / `yearly`.            |
| `anchor`  | `Date`   | today (noon) | The date the note is anchored to.                       |

Returns the vault-relative path as a string:

```js
plugin.resolvePath("daily");
// -> "Journal/2026/Q2/W20/2026-05-11 Monday.md"

plugin.resolvePath("weekly", new Date(2026, 4, 11));
// -> "Journal/2026/Q2/W20.md"
```

The path is produced by the same `resolve()` the command palette and calendar
use, so it always matches what the plugin would open or create for that date
and period -- including at year and quarter boundaries, where the containing
year and quarter follow the ISO week's Thursday rather than the calendar date.
This parity is the reason to call the API rather than rebuild the path from a
date-format string: there is no date token for "quarter of the ISO week's
Thursday", so a format string diverges at those boundaries.

## Why no `exists` / `find` here

The CLI offers `exists` and `find` because a shell caller has no other way to
touch the vault. An in-renderer script already holds `app`, so existence
checks (`app.vault.getAbstractFileByPath(path)`) and creation/opening are a
line away once it has the path. `resolvePath` supplies the one thing a script
cannot easily compute correctly on its own. Add more surface only if a real
caller needs it.
