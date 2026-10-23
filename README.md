# Obsidian Daily Note Navigator

An Obsidian community plugin for navigating daily and periodic notes.

Obsidian's built-in daily notes (and the Periodic Notes community plugin)
cover creating and opening notes for a given date, but quick navigation
between existing periodic notes -- daily, weekly, quarterly, yearly -- is
more manual than it needs to be. This plugin makes moving through that
calendar of notes fast.

> [!CAUTION]
> This project is completely AI slop and only developed with my usage in mind. It's tested and I daily drive it, but I've never read the code and don't intend to.

## What it does

- **Calendar sidebar.** A month grid in the right sidebar. Click a day
  to open its daily note, the week number to open the weekly note, the
  `Q{n}` link for the quarterly note, or the year for the yearly note.
  Cells whose note already exists are marked with a dot, and the cell
  for the active periodic note is highlighted. The view reveals itself
  automatically when the workspace is ready.
- **Command palette.** Open today's daily note, this week's weekly note,
  this quarter's quarterly note, this year's yearly note, the previous
  or next note for the current period, or pick an arbitrary date or
  period reference through a modal.
- **Ribbon icon.** A calendar-check icon that opens today's daily note.
- **Templates.** Per-period template paths configured in Settings. If
  Templater is installed, its `<% %>` tags are processed when a new
  note is created; otherwise the template is copied verbatim. Leave a
  field empty to create that period's notes as blank files.
- **CLI.** `daily-note-navigator:path`, `daily-note-navigator:exists`, and
  `daily-note-navigator:find` subcommands for the
  Obsidian CLI, intended for scripts and LLM workflows.

## Folder layout

Notes live under a fixed `Journal/` hierarchy in v1:

```
Journal/
  {year}.md
  {year}/
    Q{quarter}.md
    Q{quarter}/
      W{week}.md
      W{week}/
        {YYYY-MM-DD} {DayName}.md
```

`{year}` is the ISO week-year and `{week}` is the ISO week number, so
year-boundary weeks stay in a single folder. See
[docs/design/folder-layout.md](docs/design/folder-layout.md) for the
full rules and worked examples, including the boundary edge cases.

## Status

First release: 0.1.0. Not yet listed in the Obsidian community-plugins
registry.

## Installation

The plugin is not yet listed in the Obsidian community-plugins
registry. The recommended way to install it in the meantime is via
[BRAT](https://github.com/TfTHacker/obsidian42-brat), the Beta
Reviewers Auto-update Tool, which installs and updates plugins
directly from GitHub releases.

1. Install BRAT from Settings -> Community plugins -> Browse, and
   enable it.
2. Open the command palette and run **Obsidian42 - BRAT: Plugins:
   Add a beta plugin for testing (with or without version)**.
3. Paste `https://github.com/Errorific/obsidian-daily-note-navigator`
   as the repository. Leave the version blank to track the latest
   release, or pin to a specific tag (e.g. `0.1.0`).
4. BRAT installs the plugin. Enable **Daily Note Navigator** under
   Settings -> Community plugins.

BRAT will pick up future releases automatically when you run its
"Check for updates" command, or on Obsidian startup if you have that
option enabled in its settings.

For local development, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) -- high-level technical overview
- [CONTRIBUTING.md](CONTRIBUTING.md) -- how to work on the plugin
- [docs/](docs/) -- extended documentation (design, decisions, research, dev, user)

## License

See [LICENSE](LICENSE).
