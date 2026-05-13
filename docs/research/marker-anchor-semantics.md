# Marker Anchor Semantics

What should `{{dnn.year}}`, `{{dnn.quarter}}`, and `{{dnn.week}}` mean
inside a quarterly or yearly template? Today they describe the **input
anchor** passed into the creation flow; the alternative is to derive
them from the **canonical anchor** of the period so all four
period-shape markers (`year`, `quarter`, `week`, `anchor_date`) describe
the same point in time.

This document frames the trade-off so a decision can be made. It is not
a decision -- when one is made, write an ADR superseding this section's
recommendation.

References:

- [Templates design](../design/templates.md), in particular the
  "Available markers" section and the "describe the input anchor" note.
- [Folder layout](../design/folder-layout.md) -- the resolver these
  markers report on.

## Where the question comes from

The marker context is built in `src/templates/context.ts` by
`buildContext(anchor, period, resolved)`. Today:

- `year` / `quarter` / `week` are computed from the input `anchor` via
  `isoWeekOf(anchor)` and `quarterOfWeek(anchor)`.
- `anchor_date` is computed separately as the canonical anchor for the
  period: the date itself for daily, the Monday for weekly, the first
  Thursday of the quarter for quarterly, July 1 for yearly.

For daily and weekly the input anchor *is* the canonical anchor, so all
four agree. For quarterly and yearly they can disagree, because the
input anchor depends on how the note was triggered.

## Worked examples (current behaviour)

Triggering a quarterly note for Q2 2026 via `dnn:find period=quarterly
ref=2026/Q2`. The ref parser uses mid-month of the middle month
(2026-05-15), so:

| Marker             | Value         |
|--------------------|---------------|
| `{{dnn.year}}`     | `2026`        |
| `{{dnn.quarter}}`  | `2`           |
| `{{dnn.week}}`     | `20`          |
| `{{dnn.anchor_date}}` | `2026-04-02` (first Thursday of Q2) |

`week` says 20, the week that contains May 15. A quarterly template
that includes `# Q{{dnn.quarter}} {{dnn.year}}, starting in week
{{dnn.week}}` would render "starting in week 20", which is wrong.
"Starting in week 14" (the first week of Q2) would be the correct
reading.

Triggering a yearly note via `dnn:find period=yearly ref=2026`. The ref
parser uses July 1, so:

| Marker             | Value         |
|--------------------|---------------|
| `{{dnn.year}}`     | `2026`        |
| `{{dnn.quarter}}`  | `3`           |
| `{{dnn.week}}`     | `27`          |
| `{{dnn.anchor_date}}` | `2026-07-01` |

`quarter` and `week` reflect July 1, not the year as a whole.

If the same yearly note is triggered with `date=2026-12-15` instead of
`ref=2026`, the markers shift to `quarter=4`, `week=51`. Same file
created either way; different marker values.

## Option A: keep current behaviour (input-anchor-derived)

`year` / `quarter` / `week` describe whatever date was passed in.

Pros:

- Preserves the "when did the user trigger this" signal. A yearly note
  created on a specific date can include `{{dnn.week}}` to know which
  week the user was in when they created it.
- No code change.

Cons:

- Two markers (`week`, `quarter`) effectively describe a moving target
  inside quarterly and yearly templates. Template authors must remember
  not to use them as scope descriptors for those periods.
- The same note path gets different marker values depending on which
  selector (`date=` vs `ref=` vs default-today) drove its creation.
- The existing `docs/design/templates.md` already warns users away from
  these markers in quarterly/yearly templates -- a sign that the
  semantics are unintuitive.

## Option B: derive from the canonical anchor

`year` / `quarter` / `week` are computed from the same canonical anchor
that `anchor_date` already uses. All four markers always agree.

Pros:

- All period-shape markers describe the same point in time.
- Round-trip safe: feeding `{{dnn.anchor_date}}` back into the resolver
  produces the same `{{dnn.year}}` / `{{dnn.quarter}}` / `{{dnn.week}}`
  values.
- Templates can use any of the four interchangeably without having to
  remember which describe the input and which describe the period.

Cons:

- For quarterly templates, `{{dnn.week}}` would always be the week of
  the first Thursday of the quarter (W14 for Q2, W27 for Q3...). A
  surprising value if a template author was hoping for a useful
  per-week number.
- For yearly templates, `{{dnn.week}}` would always be W27 (week of
  July 1). Effectively meaningless.
- Loses the "user clicked this on May 15" signal entirely; if a user
  wants it, they have to read `{{dnn.anchor_date}}` differently
  (parse it themselves) or we expose a separate marker.
- Subtle semantic shift for any existing templates that were relying on
  the current behaviour. (At time of writing, no such templates exist;
  the plugin is pre-release.)

Implementation impact: small. One helper call in `buildContext` -- pass
the canonical anchor through `isoWeekOf` / `quarterOfWeek` instead of
the input anchor.

## Option C: keep both, with distinct names

Keep `{{dnn.year}}` / `{{dnn.quarter}}` / `{{dnn.week}}` as
input-anchor-derived (current), and add a separate set
(`{{dnn.period_year}}`, `{{dnn.period_quarter}}`, `{{dnn.period_week}}`
-- naming TBD) that are canonical-anchor-derived.

Pros:

- Both signals are available; template authors pick the right one.
- No behaviour change for existing templates.

Cons:

- Doubles the marker surface for a corner case.
- Names are awkward (no obvious short distinguishing suffix).
- More to document and explain.

## Recommendation

**Option B.** The chief argument against the input-derived defaults is
that the current behaviour already requires a section in
`templates.md` warning users away from these markers in
quarterly/yearly templates. A marker that needs a warning to use safely
is a marker with the wrong default. Option B makes
`{{dnn.year}} / {{dnn.quarter}} / {{dnn.week}}` *always* describe the
period the note is for, which is the more useful reading in practice
and the one a casual user is more likely to expect.

The cost is real but bounded: yearly templates lose a meaningful
`{{dnn.week}}` value (it becomes a constant), and quarterly templates
get a stable but not very useful "first week of the quarter". If a
user genuinely wants to know what week of the year a particular note
was triggered from, they have `{{dnn.anchor_date}}` and Templater's
own `tp.date.*` helpers for that.

Option C is a fallback if Chris feels strongly that the input-derived
behaviour must remain available.

## Decision needed before

This isn't blocking. Templates haven't been written against the current
behaviour by anyone other than test fixtures, so a flip costs us
nothing today. The longer the plugin lives with the current defaults,
the more user templates may rely on them.

A reasonable trigger: pin a decision before the first public release.

## If we pick Option B

Implementation sketch:

1. In `src/templates/context.ts`, replace the `isoWeekOf(anchor)` /
   `quarterOfWeek(anchor)` calls with calls on the canonical anchor
   (already computed for `anchor_date`). One helper, used twice.
2. Update `docs/design/templates.md`: remove the "describe the input
   anchor" subsection and update the marker table's notes to reflect
   the canonical-anchor semantics.
3. Update the round-trip tests in
   `src/templates/context.test.ts` to assert the new alignment.
4. Write an ADR superseding this research doc's recommendation, citing
   the templates.md change as the implementation.

If we pick Option A, the only action is to leave a note in this
document recording the decision and rationale.
