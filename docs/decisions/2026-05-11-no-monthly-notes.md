---
title: No monthly notes in v1
date: 2026-05-11
status: accepted
references:
  - ../research/existing-plugins.md
  - ../design/folder-layout.md
superseded_by: null
---

# No monthly notes in v1

## Context

Other periodic-note plugins (periodic-notes, obsidian-journal) treat monthly
notes as a first-class period alongside daily, weekly, quarterly, and yearly.
Chris doesn't use monthly notes and didn't ask for them.

The question is whether to include them anyway -- they'd be cheap if the
period abstraction is general, and the sidebar calendar already needs month
boundaries to render. Or we can drop them and keep the surface narrower.

## Options Considered

### Include monthly notes from the start

Store at `Journal/{year}/Q{quarter}/M{month}.md` (or similar) and expose the
same command, CLI, and template surface as the other periods.

- Pro: marginal added complexity if the period type is a discriminated
  union -- one extra case per dispatch.
- Pro: avoids a future migration if Chris (or anyone else) decides they
  want monthly notes.
- Con: violates YAGNI per the project's stated principles.
- Con: more surface area to design and document up front: the boundary rule
  between months and ISO weeks is non-obvious (a week can straddle two
  months, mirroring the quarter problem). Pinning this down for a feature
  no one uses is wasted effort.
- Con: more user-visible commands and CLI subcommands to clutter the help
  output of a feature that's not earning its keep.

### Skip monthly notes, design for easy addition later

Define the `Period` type as a discriminated union (`'daily' | 'weekly' |
'quarterly' | 'yearly'`) with all per-period logic dispatched through it.
Adding monthly later means one new case in each switch and a new path
formula -- a local change, not a refactor.

- Pro: respects YAGNI.
- Pro: keeps the v1 surface focused and explainable.
- Pro: defers the month/week boundary question until it's actually needed.
- Con: users who do want monthly notes have to work around it (manual file
  creation, no commands, no template integration) until/unless support is
  added.

## Decision

**Skip monthly notes in v1.** Design the period type as a discriminated
union over exactly the four supported periods. Adding a fifth case later is
explicitly anticipated and should be a local change.

The sidebar calendar still renders months as a layout primitive (since
that's how humans read calendars), but the month itself has no associated
note, no command, and no CLI subcommand.

## Consequences

**Positive**

- Smaller, more focused v1 surface.
- We don't have to decide the month/week boundary rule until it's needed.

**Negative**

- If monthly notes get added later, the boundary rule between them and ISO
  weeks (a week can span two months) will need its own ADR. That's
  appropriate -- it should be a deliberate decision rather than something
  we lock in by accident now.

## Implementation note

When `Period` is added as a TypeScript discriminated union, use an
exhaustiveness check (e.g. `never`-typed default arm) so that adding a
fifth period later forces every dispatch site to handle it.
