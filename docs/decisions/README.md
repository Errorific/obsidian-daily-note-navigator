# Architectural Decision Records

This directory contains Architectural Decision Records (ADRs) for the Daily
Note Navigator plugin. ADRs capture significant decisions along with the
context and reasoning behind them.

## Rules

- **Immutable.** Once an ADR is committed, it is not modified. If circumstances
  change, write a new ADR that supersedes the old one.
- **Date-prefixed.** Name files as `YYYY-MM-DD-short-description.md`.
- **Cross-referenced.** ADRs that supersede or are related to other ADRs
  should link to them in the frontmatter. When a new ADR supersedes an older
  one, add the new ADR to the older one's `superseded_by` field -- this is
  the one permitted modification to a committed ADR.

## Format

Use the template below when creating a new ADR.

```markdown
---
title: Short descriptive title
date: YYYY-MM-DD
status: proposed | accepted | superseded
references: []
superseded_by: null
---

# Title

## Context

What is the situation that calls for a decision? What forces are at play?

## Options Considered

What alternatives were evaluated? Brief description of each with pros/cons.

## Decision

What was decided and why.

## Consequences

What follows from this decision -- both positive and negative.
```

## Index

| Date | Decision | Status |
|---|---|---|
| 2026-05-11 | [ISO 8601 week, quarter, and year boundary rules](2026-05-11-iso-week-period-boundaries.md) | accepted |
| 2026-05-11 | [No monthly notes in v1](2026-05-11-no-monthly-notes.md) | accepted |
| 2026-05-11 | [Templater is a soft dependency](2026-05-11-templater-soft-dependency.md) | accepted |
| 2026-05-16 | [Flat periodic note layout](2026-05-16-flat-periodic-note-layout.md) | accepted |
