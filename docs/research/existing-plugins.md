# Existing Periodic-Note Plugins -- Survey

Survey of the existing Obsidian plugins in the periodic-notes space, capturing
what each gets wrong (from Chris's perspective) so the design here doesn't
re-introduce the same problems.

This research is current as of 2026-05-11. Update in place if any of these
plugins materially change.

## Plugins surveyed

### periodic-notes

Long-running community plugin. The de-facto standard for years.

- **Fiddly configuration.** Per-period settings are scattered and easy to get
  into inconsistent states.
- **No flexible command workflow.** Commands exist to open notes, but there's
  no scriptable surface for "give me the path of next Tuesday's daily" or
  "create this week's weekly note if missing".
- **Unmaintained.** No active development.

### obsidian-journal

Newer entrant. Tries to support multiple journals.

- **Multi-journal model is wrong shape.** Pushes the user to build several
  independent journal collections, which doesn't match the way a single
  personal journal naturally mixes periods.
- **Can't mix periods in one journal.** A daily, a weekly, and a quarterly
  note for the same time period don't naturally live together.
- **Grab-bag feel.** Feature set spans too many tangentially-related ideas.

### daily-note-calendar

Sidebar-calendar-first plugin.

- **No variables in folder paths.** Can't express anything like
  `Journal/{year}/Q{quarter}/W{week}/`. Forces a flat or rigid layout.
- **No command workflow.** Sidebar-only; nothing scriptable from outside.

## Requirements implied by these gaps

- **One unified journal**, not multiple collections. The folder hierarchy is
  the only organising structure needed.
- **Periods coexist in the same folder tree.** A daily note for 2026-05-11
  lives next to the weekly, quarterly, and yearly notes for the same anchor.
- **Folder paths derive from date.** Year, quarter, and ISO week are computed,
  not configured per-period.
- **Opinionated defaults over configurability.** Layout is fixed (and may
  later become configurable if a concrete need appears); behaviour is
  predictable.
- **First-class command and CLI surface.** Every navigation action --
  resolve, exists-check, create, open, find-today -- is invocable
  programmatically. This is what enables LLM workflows over the journal.
- **ISO 8601 throughout.** Week numbering and boundary handling follow ISO
  rules deterministically. See the boundary-rules ADR.
- **Templater integration when present**, no-op when absent.
