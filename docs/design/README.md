# Design

Product designs and specifications for the Daily Note Navigator plugin.

Design docs are the living specs for how the plugin works. They describe
*what* something looks like in practice. For the *why* behind choices, see
the related [architectural decision records](../decisions/).

- [Folder layout and date-to-path mapping](folder-layout.md) -- the pure function that maps `(date, period)` to a vault path.
- [CLI surface](cli-surface.md) -- the `dnn:*` Obsidian-CLI subcommands.
- [Command palette surface](commands.md) -- the human-facing Obsidian commands.
- [Templates and Templater integration](templates.md) -- how new notes get populated.
- [Calendar sidebar view](calendar-sidebar.md) -- the side-panel month calendar.
