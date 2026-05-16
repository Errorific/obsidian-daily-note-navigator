# Folder Layout and Date-to-Path Mapping

The single source of truth for where periodic notes live in the vault. The
mapping is a **pure function** of a date (and a period) -- no Obsidian
dependencies, no I/O, trivially testable.

References:

- [ADR: ISO 8601 week, quarter, and year boundary rules](../decisions/2026-05-11-iso-week-period-boundaries.md)
- [ADR: No monthly notes in v1](../decisions/2026-05-11-no-monthly-notes.md)

## Folder structure

```
Journal/
  {year}.md                      -- yearly note
  {year}/
    Q{quarter}.md                -- quarterly note
    Q{quarter}/
      W{week}.md                 -- weekly note
      W{week}/
        {YYYY-MM-DD} {DayName}.md  -- daily notes (one per day)
```

Each non-daily periodic note sits as a sibling of the folder that contains
its children, rather than nested inside it. So the yearly note lives
alongside the year folder, the quarterly note alongside its quarter folder,
and the weekly note alongside its week folder.

`{year}` is the **ISO week-year**, not the calendar year of the date. For
daily notes this matters at year-boundary weeks only (see worked examples).

`{quarter}` is the calendar quarter (1-4) of the containing week's Thursday.

`{week}` is the ISO week number, zero-padded to two digits (`W01` ... `W53`).

`{YYYY-MM-DD}` is the calendar date of the daily note, in ISO format.
`{DayName}` is the full English day-of-week name (`Sunday`..`Saturday`) derived
from that date.

Filename casing and formatting:

| Period    | Filename                | Example                  |
|-----------|-------------------------|--------------------------|
| daily     | `YYYY-MM-DD {DayName}`  | `2026-05-11 Monday.md`   |
| weekly    | `W{ww}`                 | `W20.md`                 |
| quarterly | `Q{q}`                  | `Q2.md`                  |
| yearly    | `{yyyy}`                | `2026.md`                |

## Anchor-date identity model

Every periodic note is identified by an **anchor date**: any calendar date
that falls within that period. The mapping function takes the anchor date
and the period and returns folder + filename. For non-daily periods, any
date inside the period yields the same result.

```
resolve(date: Date, period: Period) -> { folder: string, filename: string }
```

- `period = 'daily'`: the anchor is the date itself.
- `period = 'weekly'`: any date in the ISO week.
- `period = 'quarterly'`: any date in the calendar quarter.
- `period = 'yearly'`: any date in the ISO week-year (or calendar year for
  quarterly/yearly periods where they don't disagree -- see "edge cases"
  below).

This gives one canonical entry point. Human-friendly references like
`2026/W20` or `2026/Q2` parse into an anchor date (e.g. the Monday of W20
2026) and go through the same function.

## The pure function (sketch)

```ts
type Period = 'daily' | 'weekly' | 'quarterly' | 'yearly';

interface Resolved {
  folder: string;     // e.g. "Journal/2026/Q2/W20"
  filename: string;   // e.g. "2026-05-11 Monday.md"
  path: string;       // folder + "/" + filename
}

function resolve(date: Date, period: Period): Resolved;
```

Implementation outline (all values derived from `date`):

1. Compute `T` = the Thursday of the ISO week containing `date`.
2. `isoYear` = `T.getFullYear()`.
3. `isoWeek` = ISO week number of `date` (equivalently, of `T`).
4. `quarter` = `Math.floor(T.getMonth() / 3) + 1`.
5. Build the folder per the structure diagram above based on the period:
   - daily:     `Journal/{isoYear}/Q{quarter}/W{isoWeek:02}`
   - weekly:    `Journal/{isoYear}/Q{quarter}`
   - quarterly: `Journal/{isoYear}`
   - yearly:    `Journal`
6. Filename per the table above.

The function is total (no exceptions for valid `Date` inputs). It does not
read or write the vault; it does not depend on Obsidian APIs.

## Worked examples

### Mid-quarter daily note

`date = 2026-05-11` (Mon, ISO week 20, Thursday 2026-05-14)

- isoYear = 2026, isoWeek = 20, quarter = 2
- Result: `Journal/2026/Q2/W20/2026-05-11 Monday.md`

### Week-spanning-quarter boundary, falling on the late side

`date = 2026-03-30` (Mon, ISO week 14, Thursday 2026-04-02)

- isoYear = 2026, isoWeek = 14, quarter = **2** (Thursday is in April)
- Result: `Journal/2026/Q2/W14/2026-03-30 Monday.md`
- Note: filename reads as a March date but folder is Q2.

### Week-spanning-quarter boundary, falling on the early side

`date = 2026-03-29` (Sun, ISO week 13, Thursday 2026-03-26)

- isoYear = 2026, isoWeek = 13, quarter = 1
- Result: `Journal/2026/Q1/W13/2026-03-29 Sunday.md`

### Year boundary -- December date in the following ISO year's folder is *not* what happens

`date = 2026-12-30` (Wed, ISO week 53, Thursday 2026-12-31)

- isoYear = 2026, isoWeek = 53, quarter = 4
- Result: `Journal/2026/Q4/W53/2026-12-30 Wednesday.md`

### Year boundary -- January date in the previous calendar year's folder

`date = 2027-01-01` (Fri, ISO week 53 of 2026, Thursday 2026-12-31)

- isoYear = **2026**, isoWeek = 53, quarter = 4
- Result: `Journal/2026/Q4/W53/2027-01-01 Friday.md`
- This is the surprising case: a 2027 filename in a 2026 folder. It's
  correct -- the ISO week containing 2027-01-01 belongs to ISO week-year
  2026, and we never split a week across folders.

### First week of a new ISO year

`date = 2027-01-04` (Mon, ISO week 1, Thursday 2027-01-07)

- isoYear = 2027, isoWeek = 1, quarter = 1
- Result: `Journal/2027/Q1/W01/2027-01-04 Monday.md`

### Quarterly note

`date = 2026-04-15` (anchor for Q2 2026)

- isoYear = 2026 (T = 2026-04-16, Thu), quarter = 2
- Result folder: `Journal/2026`
- Filename: `Q2.md`
- Path: `Journal/2026/Q2.md`

### Yearly note

`date = 2026-07-04` (any date in 2026, but note we use the ISO week-year)

- isoYear = 2026 (T = 2026-07-02, Thu), folder = `Journal`
- Filename: `2026.md`
- Path: `Journal/2026.md`

## Parsing human-friendly references

Lookup strings the LLM (or a human) might use:

| Reference     | Parsed anchor date           | Resolves to                     |
|---------------|------------------------------|---------------------------------|
| `2026-05-11`  | 2026-05-11                   | daily note                      |
| `2026/W20`    | Monday of ISO W20 2026       | weekly note                     |
| `2026/Q2`     | 2026-05-15 (mid-quarter)     | quarterly note                  |
| `2026`        | 2026-01-01 (any-day-in-year) | yearly note                     |

The parser is also a pure function:

```ts
parseReference(ref: string, period: Period): Date
```

Invalid references throw; the resolve function never receives invalid input.

## Edge cases and open questions

- **Yearly anchor and ISO week-year mismatch.** A naive "any date in calendar
  year 2026" choice of 2026-01-01 actually falls in ISO week-year 2025
  (because 2026-01-01 is a Thursday belonging to W1 of 2026 -- OK that's
  fine -- but pick 2026-01-03, a Saturday, and you're in W53 of 2025). The
  yearly resolver should be careful: it interprets its input as "the ISO
  week-year I want" and is implemented by computing from a date that
  unambiguously lies inside it, e.g. July 1st of that year.
- **Quarterly anchor and calendar-quarter mismatch.** The same boundary
  problem applies to quarters. A "first day of Q1 2027" anchor of
  2027-01-01 (Fri) has its ISO Thursday on 2026-12-31, so the resolver
  would file it under `Journal/2026/Q4/`. Reference parsing therefore
  uses the 15th of the middle month of the requested quarter (Feb 15 /
  May 15 / Aug 15 / Nov 15) -- a date that unambiguously lies inside the
  calendar quarter regardless of how its ISO week is laid out.
- **Daylight saving / timezone.** All date math operates in the user's local
  timezone (Obsidian convention). We do not normalise to UTC. ISO week
  computation is timezone-stable so long as the input date is interpreted
  consistently.
- **Locale week start.** ISO 8601 weeks always start on Monday. We do not
  respect the platform's locale setting here.

## Implementation placement

The pure function lives in `src/dates/` (or similar) and is exported with no
Obsidian imports. Tests live alongside it. Everything else in the plugin
(commands, calendar view, CLI handlers, template resolver) calls into this
module rather than re-deriving any of the path logic.
