# Templates and Templater Integration

How periodic notes are populated when they're first created. Covers the
plain-template path and the Templater-integrated path.

References:

- [ADR: Templater is a soft dependency](../decisions/2026-05-11-templater-soft-dependency.md)
- [CLI surface](cli-surface.md) -- subcommands that trigger creation.
- [Command palette surface](commands.md) -- "open X" commands that create
  through this same flow.

## Settings (defaults are sensible; no setup required)

Per-period optional template path. Stored in plugin settings:

```ts
interface Settings {
  templates: {
    daily?: string;      // vault-relative path, e.g. "Templates/Daily.md"
    weekly?: string;
    quarterly?: string;
    yearly?: string;
  };
}
```

If a period's template is unset, notes for that period are created empty
(no template processing at all).

The plugin does not provide built-in templates. Users supply their own
files anywhere in the vault. We recommend a single `Templates/` folder by
convention but don't enforce it.

## Creation flow

The single canonical flow used by every code path that creates a periodic
note (CLI's `dnn:find create`, command palette's "open X" commands, future
"create X" commands):

```
        +----------------------------+
        |  resolve(date, period)     |
        |    --> path                |
        +-------------+--------------+
                      |
                      v
        +----------------------------+
        |  Does the file exist?      |--- yes ---> return path (no-op)
        +-------------+--------------+
                      | no
                      v
        +----------------------------+
        |  template configured       |
        |  (or template= override)?  |--- no ----> vault.create(path, "")
        +-------------+--------------+              return path
                      | yes
                      v
        +----------------------------+
        |  Read template file        |--- fails -> Error, no file created
        +-------------+--------------+
                      |
                      v
        +----------------------------+
        |  Substitute {{dnn.*}}      |
        |  markers (see below)       |
        +-------------+--------------+
                      |
                      v
        +-------------+--------------+
        |  Add path to Templater's   |
        |  files_with_pending_       |
        |  templates set, IF         |
        |  Templater is available    |
        +-------------+--------------+
                      |
                      v
        +----------------------------+
        |  Create parent folders     |
        |  Create empty target file  |
        +-------------+--------------+
                      |
                      v
        +----------------------------+
        |  Templater available?      |
        +--+------------------+------+
           | yes              | no
           v                  v
   +-----------------+   +------------+
   | parse_template  |   | use the    |
   | (template_file, |   | substitute |
   |  target, mode)  |   |  output    |
   |    --> content  |   |  as-is     |
   +--------+--------+   +-----+------+
            |                  |
            +--------+---------+
                     |
                     v
        +----------------------------+
        |  vault.modify(target,      |
        |  rendered content)         |
        +-------------+--------------+
                      |
                      v
        +----------------------------+
        |  Remove path from          |
        |  files_with_pending_       |
        |  templates set             |
        +-------------+--------------+
                      |
                      v
                  return path
```

## Step-by-step

1. **Resolve the path** using the pure resolver. No I/O.
2. **Check existence** via `app.vault.getAbstractFileByPath(path)`. If the
   note exists, return its path; do not modify it. Creation is idempotent.
3. **Identify the template**. If a `template=` flag was provided on the
   CLI, use that. Otherwise look up the configured template for the
   period. If neither is set: create the file empty, return its path,
   done.
4. **Read the template file**. If the template path doesn't resolve to a
   file in the vault, return an error and abort -- do not create an empty
   note as a fallback. The configured-template case implies the user
   wanted a template; silently dropping back to "empty" hides the bug.
5. **Pre-substitute `{{dnn.*}}` markers** (see "Context variables" below).
   This pass runs whether Templater is available or not, so templates
   can rely on it.
6. **Guard against Templater's create trigger.** If Templater is
   available, add the target path to
   `templater.files_with_pending_templates` (a `public` Set on the
   Templater core that's used exactly for this purpose -- see "Templater
   create-trigger interaction" below). The path is removed in a `finally`
   after step 9.
7. **Create parent folders and the empty target file.** `vault.create(path, "")`.
   With the pending-set guard in place, Templater's folder-template
   trigger will see the file but skip it.
8. **Render via Templater (if available), then write.** Build a
   `RunningConfig` pointing at the freshly created target and the
   user's template `TFile`, call
   `templater.parse_template(config, substituted_content)`, and write
   the result via `vault.modify(target, content)`. If Templater is
   not available, write the substituted content directly to the target
   instead.
9. **Return the path** to the caller. Opening the note (if requested) is
   the caller's responsibility, not the template flow's.

## Templater integration details

We access Templater via `app.plugins.plugins["templater-obsidian"]`:

```ts
function getTemplater(app: App) {
  const plugin = app.plugins.plugins["templater-obsidian"] as
    | (TemplaterPlugin & { templater: TemplaterCore }) | undefined;
  return plugin?.templater;
}
```

The `TemplaterCore` has the methods we need: `create_running_config`,
`parse_template`. We call:

```ts
const config = templater.create_running_config(
  templateFile,            // the user's template TFile
  targetFile,              // our newly-created (empty) note TFile
  RunMode.CreateNewFromTemplate,
);
const content = await templater.parse_template(config, substituted);
```

(`substituted` is the template body after our own `{{dnn.*}}` pass --
see the next section.)

Templater's `RunningConfig` needs a target `TFile`, which is why we
create the empty file first and then parse-and-modify. The price is a
brief window where the note exists on disk with empty content; this is
the same pattern Templater itself uses in `create_new_note_from_template`.

### Templater create-trigger interaction

Templater optionally hooks the vault's file-creation event and runs its
own logic on every newly-created file. There are two distinct paths in
that handler (see `Templater.ts` in the Templater source):

- **Folder templates**: if the new file is in a configured folder and is
  empty, Templater applies that folder's configured template to the file,
  overwriting any content. If we don't guard against this, our just-created
  empty target gets overwritten with the wrong template before we get a
  chance to write our processed content.
- **Overwrite file commands**: for non-empty files, Templater re-evaluates
  any `<% ... %>` markers in the existing content. This is the
  "double-processing" path. It's normally harmless because well-formed
  Templater output contains no leftover markers -- the second pass finds
  nothing to do. The only failure mode is a template whose rendered
  *output* contains literal `<% %>` text, which is a problem the user has
  brought on themselves regardless of our plugin.

We block the folder-templates path explicitly. We don't block the
overwrite-file-commands path because it's harmless in the common case and
useful in the uncommon case where a user genuinely wants a second
evaluation pass.

**The mechanism**: Templater's core exposes a `public` Set named
`files_with_pending_templates`. Its trigger handler checks this set
before applying folder templates and bails if the new file's path is in
it. Templater uses this set internally to avoid recursive triggering
during its own `create_new_note_from_template` flow. We use the same
hook:

```ts
templater.files_with_pending_templates.add(targetPath);
try {
  // create empty file, parse_template, modify, etc.
} finally {
  templater.files_with_pending_templates.delete(targetPath);
}
```

The pending-set check is the very first thing Templater's handler does
after its 300ms wait (see `Templater.ts` line ~562), so the timing is
forgiving: as long as the path is in the set before the handler resumes
from its `await delay(300)`, we win.

If a future Templater version renames or removes this set, our guard
becomes a no-op. We feature-detect (`if (templater.files_with_pending_templates instanceof Set)`)
and skip the guard if missing. The worst case is a user whose folder
template setting points at the journal: their first-pass content gets
overwritten by Templater's folder template. We log a warning. We do not
silently corrupt the note.

### Templater error handling

If `parse_template` throws (template syntax error, prompt cancelled, etc.):

- Delete the empty target file. **The user is left with the same state
  they had before the call.**
- Return the Templater error message to the caller, prefixed with
  `Templater: `, so the CLI's standard error wrapping reports it as
  `Error: Templater: <message>`.

This matches the Templater plugin's own behaviour for failed template
parsing (see `create_new_note_from_template` in Templater's source -- it
deletes the file on `output_content == null`).

## Context variables (`{{dnn.*}}` markers)

Templates often want to know what they're being instantiated for: which
period, which date, which folder. We provide these via a small set of
substitution markers that run *before* Templater processes the content.
The substitution is a single pure pass of `String.replaceAll` calls --
no parser, no escaping, no Templater dependency.

Markers use the `{{dnn.*}}` namespace so they don't collide with
Templater's `<% ... %>` syntax, the core Templates plugin's `{{date}}`
and `{{title}}` syntax, or any other template convention we know of.

### Available markers

For a creation with `period = daily` and `anchor = 2026-05-11`:

| Marker                 | Value                                  |
|------------------------|----------------------------------------|
| `{{dnn.period}}`       | `daily`                                |
| `{{dnn.year}}`         | `2026`  (ISO week-year)                |
| `{{dnn.quarter}}`      | `2`                                    |
| `{{dnn.week}}`         | `20`    (zero-padded ISO week)         |
| `{{dnn.anchor_date}}`  | `2026-05-11`                           |
| `{{dnn.folder}}`       | `Journal/2026/Q2/W20`                  |
| `{{dnn.filename}}`     | `2026-05-11` (no extension)            |
| `{{dnn.path}}`         | `Journal/2026/Q2/W20/2026-05-11.md`    |

For non-daily periods, `anchor_date` is the canonical anchor of the
period: a date that the resolver maps back to the same folder when fed
through it again. This means the value is safe to round-trip via the CLI
`date=` flag or any other place a date is fed back into the resolver.

| Period    | Canonical anchor for `{{dnn.anchor_date}}`     |
|-----------|------------------------------------------------|
| daily     | the daily-note date                            |
| weekly    | Monday of the ISO week                         |
| quarterly | first Thursday of the calendar quarter         |
| yearly    | July 1 of the ISO week-year (mid-year, avoids both ISO and calendar year-boundary ambiguity) |

The quarterly anchor uses the first Thursday of the calendar quarter
rather than the first day, so it composes cleanly with the resolver's
own "Thursday determines ISO year and quarter" rule (see ADR
[2026-05-11-iso-week-period-boundaries](../decisions/2026-05-11-iso-week-period-boundaries.md)).
A first-day choice fails for `Q1` years whose Jan 1 falls on Fri/Sat/Sun
(2027, 2033, ...) because that date belongs to the previous ISO
week-year. The first Thursday is always in the requested ISO year and
within the first seven days of the quarter.

### Why pre-substitute rather than expose a Templater user function?

Templater has its own user-function mechanism (`tp.user.*`) and a
"user system functions" setting. We could register `tp.user.dnn.year`
etc., but that requires the user to configure Templater's user-script
folder and write a wrapper script -- a non-trivial step. The
substitution approach works out-of-the-box and even works when
Templater isn't installed (in which case it's the only template
processing that happens).

### Templater can still see the values inside `<% %>` blocks

Substitution runs first, so a template like

```
<% tp.date.now("YYYY-[W]ww") %> -- written for {{dnn.year}}/{{dnn.period}}
```

becomes

```
<% tp.date.now("YYYY-[W]ww") %> -- written for 2026/daily
```

before Templater sees it. Templater then runs the date function and
produces the final output. Both layers compose cleanly.

If a user *does* want a marker inside a `<% %>` block (e.g.
`<% tp.user.lookup("{{dnn.year}}") %>`), the substitution still happens
first, so the marker is replaced with `2026` before Templater parses the
block.

## Plain-template path (no Templater)

When Templater is unavailable:

```ts
const raw = await app.vault.read(templateFile);
const content = substituteDnnMarkers(raw, context);
const target = await app.vault.create(path, content);
```

The `{{dnn.*}}` pass still runs, so templates can rely on those markers
regardless of whether Templater is installed. Templater-specific syntax
(`<% %>`) is passed through as literal text.

## Empty creation path (no template configured)

```ts
const templater = getTemplater(app);
templater?.files_with_pending_templates.add(path);
try {
  await app.vault.create(path, "");
} finally {
  templater?.files_with_pending_templates.delete(path);
}
```

We still guard with the pending-set hook in this path, so a user with no
template configured for a period **and** a Templater folder-template
covering `Journal/` doesn't get Templater's folder template applied as a
surprise. Notes we create are notes we control.

## Worked examples

### CLI find-or-create with default template

```
$ obsidian dnn:find period=daily create
created: Journal/2026/Q2/W20/2026-05-11.md
```

Settings have `templates.daily = "Templates/Daily.md"`. Templater is
installed. Result: Templater-processed daily template, written to the
resolved path.

### CLI find-or-create overriding the template

```
$ obsidian dnn:find period=daily create template=Templates/Bare.md
created: Journal/2026/Q2/W20/2026-05-11.md
```

`Templates/Bare.md` is used instead of the configured one. Templater still
processes it.

### CLI find-or-create with no Templater installed

Same as above, but the template content is copied verbatim. Users see
unsubstituted `<% tp.date.now() %>` in the resulting note -- their fault
for using Templater syntax in a vault without Templater.

### Failure: template path doesn't exist

```
$ obsidian dnn:find period=daily create template=Templates/Missing.md
Error: template 'Templates/Missing.md' not found
```

No file is created.

### Failure: Templater error

```
$ obsidian dnn:find period=weekly create
Error: Templater: Template parsing error: unexpected token at line 3
```

The placeholder file we briefly created is deleted before returning.

## Open questions

- **Per-period defaults via convention?** We could look for
  `Templates/Daily.md` etc. by convention when settings are unset. Decline
  for v1 -- explicit settings are easier to reason about. Easy to add
  later.
- **Marker extensions.** The `{{dnn.*}}` set above covers the obvious
  facts. If we find ourselves wanting more (e.g. `{{dnn.prev_path}}` for
  a back-link, or `{{dnn.week_of_quarter}}` for "this is week 7 of Q2"),
  add them then. Avoid adding markers speculatively -- each one becomes
  a contract we're stuck supporting.
