---
title: Templater is a soft dependency
date: 2026-05-11
status: accepted
references:
  - ../design/templates.md
  - ../research/cli-extension-api.md
superseded_by: null
---

# Templater is a soft dependency

## Context

Notes created by this plugin should support templates. Plain markdown
templates (just a file we copy verbatim) are easy. Templater
(`templater-obsidian`) is a widely-used Obsidian plugin that processes
templates with a rich syntax including dates, prompts, and JavaScript. Many
journal workflows rely on it for things like the date header in a daily
note.

The question is the nature of the dependency:

1. **Hard dependency** -- the plugin requires Templater to function; users
   without Templater are told to install it.
2. **Soft dependency** -- the plugin works without Templater (plain
   templates only), and integrates if Templater is present.
3. **No Templater integration** -- only ever copy templates verbatim;
   users who want richer logic configure Templater's own "trigger on file
   creation" feature instead.

## Options Considered

### Hard dependency

- Pro: simpler implementation -- one code path.
- Pro: aligns with how most heavy journal users configure things anyway.
- Con: Obsidian doesn't really have a "depends on" mechanism for plugins.
  We'd have to detect-and-refuse at load, which is a bad UX.
- Con: forces a third-party dependency on every user, including those
  whose templates are plain markdown.

### Soft dependency

- Pro: works for both audiences -- plain-template users and
  Templater-power-users -- without extra configuration.
- Pro: graceful degradation: if Templater is uninstalled or disabled, the
  plugin still creates notes (just without Templater processing).
- Pro: matches the requirement Chris stated explicitly ("if it's
  available").
- Con: two code paths to test (with and without Templater).
- Con: the "Templater is available but errors" case has to be handled
  explicitly.

### No Templater integration

- Pro: simplest possible.
- Con: users who want Templater syntax in their daily-note templates have
  to rely on Templater's "trigger on file creation" feature, which has
  ordering and reliability issues when multiple plugins create files. We
  would surrender control over the creation flow to a setting that lives
  in another plugin.
- Con: means the plugin can't promise "your template is fully processed
  before the file is opened."

## Decision

**Soft dependency.** Detect Templater at runtime via
`app.plugins.plugins["templater-obsidian"]`. If present, route template
content through Templater's `parse_template` API. If absent (or disabled,
or failing), fall back to copying the template content verbatim.

The plugin never lists Templater as a `dependencies` entry in
`manifest.json` (Obsidian doesn't honour one anyway), and the plugin loads
and works regardless of Templater's state.

## Consequences

**Positive**

- The plugin is usable by both audiences.
- We control the creation flow end-to-end -- no reliance on Templater's
  "trigger on file creation" setting.
- Users can install or uninstall Templater without breaking our plugin.

**Negative**

- Two code paths to maintain and test. Mitigation: the Templater branch is
  a thin wrapper, and the fallback branch is "write the file contents as
  read".
- We rely on Templater's internal API
  (`app.plugins.plugins["templater-obsidian"].templater.parse_template`)
  rather than a documented public surface. If Templater renames or
  reshapes this API we have to update. Mitigation: the call site is
  isolated to one module and feature-detected.

## Implementation notes

- The detection call returns the Templater plugin instance. Its
  `.templater` property holds the core Templater object with the
  `parse_template`, `read_and_parse_template`, and `create_running_config`
  methods we use.
- We call `parse_template` with a `RunningConfig` that points to our newly
  created note as the target file. We never use Templater's own
  `create_new_note_from_template` because it doesn't compose with our
  path-resolution logic.
- A Templater error during parsing aborts the note creation -- we do not
  leave a partially-written file in the vault. See the templates design
  doc for the exact sequence.
