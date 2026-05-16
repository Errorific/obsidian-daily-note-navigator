# Calendar Sidebar View

A side-panel view that renders the current (or any chosen) month as a
calendar grid and lets the user jump to daily, weekly, quarterly, and
yearly notes with a click.

References:

- [Folder layout](folder-layout.md) -- every click dispatches through the
  same pure resolver.
- [ADR: ISO 8601 week, quarter, and year boundary rules](../decisions/2026-05-11-iso-week-period-boundaries.md)

## Layout

```
+--------------------------------------------+
|  < May 2026 >  [Today]      Q2  ·  2026    |   <- header
+----+----+----+----+----+----+----+----+
| WK | M  | T  | W  | T  | F  | S  | S  |
+----+----+----+----+----+----+----+----+
| 18 | 27 | 28 | 29 | 30 |  1 |  2 |  3 |
| 19 |  4 |  5 |  6 |  7 |  8 |  9 | 10 |
| 20 | 11 | 12 | 13 | 14 | 15 | 16 | 17 |   <- 11 highlighted = today
| 21 | 18 | 19 | 20 | 21 | 22 | 23 | 24 |
| 22 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
+----+----+----+----+----+----+----+----+
```

The header shows:

- The displayed month name (plain text -- we have no monthly notes, so
  it does not link anywhere) followed by the displayed year as a link
  to that year's yearly note.
- A row of icon-only controls (prev month, today, next month). No
  always-visible borders or backgrounds: hover effects only, in keeping
  with the rest of Obsidian's chrome.

The grid:

- The top-left header cell holds the displayed month's **calendar
  quarter** (e.g. `Q2`) as a link to that quarterly note. This sits
  where a "WK" label would otherwise go and saves a header row.
- One row per ISO week that intersects the displayed month.
- Leftmost column is the **ISO week number** (`W18`-style, but rendered
  compactly as just the digits). Clicking opens that week's weekly note.
- Seven date columns, Monday-first. Clicking opens that day's daily note.
- Cells outside the displayed month are dimmed but remain clickable (their
  daily notes are real notes, just for adjacent months).

## Click targets

| Element                       | Action                                                |
|-------------------------------|-------------------------------------------------------|
| Day cell                      | Open daily note for that date.                        |
| Week-number cell              | Open weekly note for that ISO week.                   |
| Grid `Q{n}` link (top-left)   | Open quarterly note for the month's calendar quarter. |
| Header year link              | Open yearly note for the month's calendar year.       |
| Today icon button             | Reset the view to the current month and focus today.  |
| Prev / next icon buttons      | Step the displayed month back or forward.             |

**Important**: the header's `Q` and year reflect the **calendar** month
being displayed, but the cells' resolver follows the ISO-Thursday rule.
These can disagree at boundary weeks, and they should:

- Display showing January 2027 with W53 2026 as its leading row.
- The header's year link goes to `Journal/2027.md`.
- The W53 row's week link goes to `Journal/2026/Q4/W53.md`.
- A day cell for `1` (2027-01-01) in that row goes to
  `Journal/2026/Q4/W53/2027-01-01 Friday.md`.

That's correct -- those are three different time concepts. The view
simply makes each one navigable to the right place via the resolver.

## Modifier keys

| Modifier      | Behaviour                              |
|---------------|----------------------------------------|
| Click         | Open in current tab.                   |
| Cmd/Ctrl-click | Open in a new tab.                    |
| Middle-click   | Open in a new tab. (Standard Obsidian) |

## Visual state

- **Today** (the daily for today's date): a distinct highlight on the
  day cell. Even when the user has navigated to a different month, the
  current month's "today" cell stays highlighted if it appears.
- **Notes that exist**: day cells whose daily note exists in the vault
  get a small dot under the number. The same dot indicator applies to
  week-number cells (whose weekly note exists) and to the header's Q and
  year links. Implementation note: query
  `app.vault.getAbstractFileByPath(...)` on render only for the visible
  cells; don't crawl the vault.
- **Selected**: when a periodic note is the active file, its anchor cell
  in the calendar gets a "current" highlight. For a weekly note, the
  whole row highlights subtly. For quarterly/yearly notes, the header's
  Q or year link gets a current style.

## Behaviour: creating missing notes

The calendar view does **not** create notes by default. Clicking a day
whose daily note doesn't exist follows the same flow as the "open today's
daily" command palette command: create-with-template, then open. This
makes the calendar a navigation surface that mirrors the command set.

If we later add a "preview on hover" feature, hover **never** creates --
hovering is read-only.

## View registration and placement

- Registered via `Plugin.registerView` under an ID like
  `daily-note-navigator:calendar`.
- A "Show calendar" command opens the view in the right sidebar by
  default (`workspace.getRightLeaf(false)`). Users can move it to the
  left sidebar or to a main pane like any other Obsidian view.
- One instance per workspace. Multiple instances would all show the same
  state; pointless.

## Performance

- Render is per-month. Computing the visible weeks is `O(1)` once you
  know the month's first and last days.
- Note-existence checks: at most ~42 cells (6 weeks × 7 days) plus a few
  week/quarter/year cells. Each is a single `getAbstractFileByPath` call.
  Total work is trivial.
- Re-render on `vault.on('create' | 'delete' | 'rename')` events scoped
  to paths under `Journal/`. Debounce to avoid thrashing on bulk file
  operations.

## Open questions

- **Custom journal root.** Locked to `Journal/` for v1. If we make it
  configurable later, the view re-binds to the new root path; the
  resolver already takes the root as an input (it should -- see the
  folder-layout design doc's implementation placement note).
- **Dot styling.** Decided in principle (a small dot under the number).
  Exact size, colour, and offset deferred to implementation. Use Obsidian
  CSS variables so the indicator respects the active theme.
