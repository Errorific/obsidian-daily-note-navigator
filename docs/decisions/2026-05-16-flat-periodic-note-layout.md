---
title: Flatten periodic note layout so notes sit beside their child folders
date: 2026-05-16
status: accepted
references:
  - 2026-05-11-iso-week-period-boundaries.md
superseded_by: null
---

# Flatten periodic note layout so notes sit beside their child folders

## Context

The original layout filed every periodic note inside its own same-named
folder. A weekly note lived at `Journal/2026/Q1/W1/W1.md`, a quarterly note
at `Journal/2026/Q1/Q1.md`, and a yearly note at `Journal/2026/2026.md`.
This kept all paths uniform (period note = `folder/folder.md`), but it had
two practical drawbacks:

- The repeated path segment (`W1/W1.md`, `Q1/Q1.md`, `2026/2026.md`) reads
  as boilerplate in the file picker, command palette, and breadcrumbs.
- Browsing the vault tree requires expanding the year/quarter/week folder
  just to reach the note that describes that year/quarter/week. The note
  is one step further from where the eye naturally lands.

The ISO-week boundary rules (see
[2026-05-11-iso-week-period-boundaries.md](2026-05-11-iso-week-period-boundaries.md))
are unaffected by this. Only the placement of the period note relative to
its containing folder changes.

## Options Considered

### Keep the nested layout

Status quo. Pro: every periodic note is reachable by `{folder}/{folder}.md`,
which is uniform and trivial to describe. Con: the visual and navigational
noise described above.

### Move period notes one level up, sibling to their child folder

A weekly note becomes `Journal/2026/Q1/W1.md` next to the folder `W1/`
that holds the daily notes. Similarly for quarterly and yearly.

- Pro: the note appears immediately when you open the parent folder; no
  extra click to find it.
- Pro: removes the duplicated segment in every path.
- Con: a file and a folder share a base name (`Q1.md` next to `Q1/`).
  This is supported by every file system Obsidian targets and by Obsidian
  itself, but it is visually unusual.
- Con: small migration cost for existing vaults -- files need to be moved
  up one level.

## Decision

**Adopt the flat layout.** Periodic notes sit as siblings of the folder
that contains their child period:

```
Journal/
  {year}.md                      -- yearly note
  {year}/
    Q{quarter}.md                -- quarterly note
    Q{quarter}/
      W{week}.md                 -- weekly note
      W{week}/
        {YYYY-MM-DD} {DayName}.md  -- daily notes
```

Daily notes are unchanged: they still live in the `W{week}/` folder.

## Consequences

**Positive**

- One less folder to traverse to reach any non-daily period note.
- Paths are shorter and read with less repetition.
- The `resolver` and `recognizePath` functions stay pure and total; only
  the folder string changes per period.

**Negative**

- Pre-existing vaults built with the old layout need a manual move of the
  weekly/quarterly/yearly files. The plugin does not perform migration.
- Sharing a base name between a file (`Q1.md`) and a folder (`Q1/`) can
  look unusual in some file managers. Obsidian renders them as distinct
  entries with no issue.
