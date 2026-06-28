# Using the daily note path from QuickAdd

QuickAdd's date-format placeholders (`{{DATE:...}}`) build a path from the
calendar date. Daily Note Navigator instead places a note under the year and
quarter of its ISO week's Thursday, so a `{{DATE:...}}` string drifts away from
the plugin's path at year and quarter boundaries. The week of 2027-01-01, for
example, lives under `Journal/2026/Q4/W53/` for the plugin but a calendar-based
format string would write `Journal/2027/Q1/W53/`.

To make QuickAdd agree with the plugin, ask the plugin for the path with a
QuickAdd user script instead of formatting it yourself.

## 1. Add the user script

Create a `.js` file anywhere in your vault (QuickAdd looks for scripts across
the vault), e.g. `Scripts/dailyNotePath.js`:

```js
module.exports = async (params) => {
    const plugin = params.app.plugins.plugins["daily-note-navigator"];
    if (!plugin) {
        throw new Error("Daily Note Navigator is not enabled");
    }
    const path = plugin.resolvePath("daily"); // defaults to today
    params.variables.dailyNotePath = path;
    return path;
};
```

`resolvePath` returns the full vault-relative path, e.g.
`Journal/2026/Q2/W20/2026-05-11 Monday.md`. It takes an optional period
(`"daily"`, `"weekly"`, `"quarterly"`, `"yearly"`) and an optional `Date`; with
no arguments it resolves today's daily note.

## 2. Call it from your macro

In the macro, add a **User Script** step that runs the file above before the
step that needs the path. The script both returns the path and stores it in
`params.variables.dailyNotePath`, so a later step can reference it as
`{{VALUE:dailyNotePath}}` -- for instance in a Template choice's file-name
format, replacing the old `Journal/{{DATE:YYYY/[Q]Q/[W]WW/YYYY-MM-DD dddd}}`.

## Notes

- The script depends on the plugin being enabled. The guard above turns a
  disabled or missing plugin into a clear error rather than a wrong path.
- `resolvePath` does not create the note; it only computes the path. Pair it
  with QuickAdd's own create/append behaviour, or with the plugin's
  `daily-note-navigator:find ... create` CLI command, to create the file.
