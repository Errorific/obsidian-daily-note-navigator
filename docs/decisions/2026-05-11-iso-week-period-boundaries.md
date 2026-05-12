---
title: ISO 8601 week, quarter, and year boundary rules
date: 2026-05-11
status: accepted
references:
  - ../design/folder-layout.md
  - ../research/existing-plugins.md
superseded_by: null
---

# ISO 8601 week, quarter, and year boundary rules

## Context

The plugin organises notes into a folder hierarchy `Journal/{year}/Q{quarter}/W{week}/{date}.md`.
Two boundaries need a consistent rule:

1. **Week / year boundary.** ISO 8601 weeks straddle calendar years (e.g. the
   week from 2026-12-28 to 2027-01-03 contains days from two calendar years).
2. **Week / quarter boundary.** Quarters aren't defined by ISO 8601 at all,
   but the same problem applies: a week can span Mar-31 to Apr-6, putting
   days in both Q1 and Q2.

Chris's hard requirement: **a week is never split across folders.** All seven
days of an ISO week live under the same `W{week}` folder, which in turn lives
under exactly one `Q{quarter}` folder under exactly one `{year}` folder.

That requires a deterministic rule for "which year and quarter does this week
belong to?"

## Options Considered

### Thursday's year and quarter

The week's containing year and quarter are determined by the calendar year
and quarter of that week's Thursday.

- Pro: matches ISO 8601 itself (the ISO week-year is defined by the year
  containing the week's Thursday), so year assignment is just "ISO
  week-year".
- Pro: deterministic, with no possibility of ties.
- Pro: results in a balanced split -- a week is assigned to the year/quarter
  in which the majority (4/7+) of its days fall, since Thursday is the
  middle weekday.
- Con: the daily-note filename year can disagree with the containing folder
  year for some days (e.g. `2027-01-01.md` filed under `Journal/2026/...`).
  This is structurally correct but visually surprising on first glance.

### Majority of days

The week's year/quarter is whichever has at least 4 of the week's 7 days.

- Pro: feels intuitive ("most of the week is in...").
- Con: identical to the Thursday rule for year assignment (because the ISO
  rule is itself the Thursday rule, which is equivalent to "year with 4+
  days"), so this gives nothing extra for year boundaries.
- Con: same is true for quarter boundaries -- whichever quarter contains
  Thursday always has 4+ days. No real difference.

### Monday's year and quarter

Use the calendar year and quarter of the week's first day (Monday).

- Pro: simple to compute mentally.
- Con: disagrees with the ISO week-year rule, so we'd be carrying two
  different year-assignment models (one for ISO weeks themselves, one for
  our folders). Confusing.
- Con: a week with 6 days in one quarter and 1 in another can end up in the
  minority-share quarter.

## Decision

**Year and quarter follow the week's Thursday.**

Concretely:

- A given date `D` is filed under the folder for the ISO week that contains
  `D`. That week's Thursday `T` is computed.
- The containing year folder is `T.year` (which equals the ISO week-year of
  `D`).
- The containing quarter folder is `Q{floor((T.month - 1) / 3) + 1}`.
- The week folder is `W{iso_week_number(D)}`, zero-padded to two digits.

For non-daily periods, the rule cascades: weekly notes live in the same
folder as their daily notes; quarterly notes use the same quarter
calculation applied to any date in that quarter; yearly notes use the ISO
week-year of any date in that year.

## Consequences

**Positive**

- One rule covers all three boundaries. Easy to teach, easy to test.
- Year folders align with ISO week-years, so weekly notes never straddle
  year folders.
- The implementation is a pure function of a Date and a Period; no edge
  cases beyond what ISO 8601 already defines.

**Negative**

- Daily-note filenames can lexically disagree with their containing folder.
  For example, `2027-01-01.md` lives in `Journal/2026/Q4/W53/`. This is
  correct but surprising. We document it in the folder-layout design doc
  with worked examples.
- A daily note whose date falls in calendar Q2 may live in the Q1 folder
  (e.g. 2026-03-30 is in W14, whose Thursday is 2026-04-02, so the folder
  is `Journal/2026/Q2/W14/` -- in this case the filename also reads as Q2,
  but the analogous case the other way is 2026-03-29, a Sunday in W13 with
  Thursday 2026-03-26, so it lives in `Journal/2026/Q1/W13/2026-03-29.md`
  while being part of calendar-week W13's only-just-Q1 stretch).
