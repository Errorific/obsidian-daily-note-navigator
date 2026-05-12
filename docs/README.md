# Documentation

Detailed documentation for the Daily Note Navigator plugin. For a project
overview, see the [top-level README](../README.md).

## Structure

| Directory | Purpose | Mutability |
|---|---|---|
| [user/](user/) | Extended user documentation | Evergreen |
| [development/](development/) | Dev setup, testing, patterns, style guides | Evergreen |
| [decisions/](decisions/) | Architectural decision records | Immutable once committed |
| [research/](research/) | Investigations and analysis by topic | Evergreen |
| [design/](design/) | Product designs and specifications | Evergreen |

## Which directory do I use?

**I'm documenting how to use the plugin.** Put it in `user/`. The root README
is a landing page; detailed usage, configuration reference, and examples go
here.

**I'm documenting how to work on the plugin.** Put it in `development/`. Setup
instructions, testing scenarios, debugging guides, style guides, and
development patterns belong here.

**I've made (or am proposing) a significant decision.** Write an ADR in
`decisions/`. ADRs capture the context, options considered, and rationale
behind a choice. They are never modified after being committed -- if
circumstances change, write a new ADR that supersedes the old one. See the
[decisions README](decisions/README.md) for the format.

**I'm investigating something.** Put it in `research/`. Research docs are
arranged by topic and reflect our current understanding. When new research
disproves or changes earlier findings, update the document to reflect the new
understanding. If a reversal is significant enough to be worth noting, a brief
note explaining the change is appropriate, but don't try to preserve the full
history of superseded conclusions inline.

**I'm specifying how something should work.** Put it in `design/`. Design docs
are the living specifications for the plugin's product behavior. Where a
`decisions/` ADR records *why* a choice was made, a `design/` doc describes
*what* that choice looks like in practice. ADRs and design docs will often
reference each other.
