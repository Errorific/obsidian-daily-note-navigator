// Registers the dnn:* Obsidian CLI subcommands. Schemas mirror
// docs/design/cli-surface.md; the actual work lives in ./handlers.ts so it
// can be tested without a Plugin instance.

import type { Plugin } from "obsidian";
import type { Settings } from "../settings";
import {
	type CliDeps,
	handleExists,
	handleFind,
	handlePath,
} from "./handlers";

export interface PluginWithSettings extends Plugin {
	settings: Settings;
}

const SELECTOR_FLAGS = {
	period: {
		value: "<daily|weekly|quarterly|yearly>",
		description: "The periodic-note period to resolve.",
		required: true,
	},
	date: {
		value: "<YYYY-MM-DD>",
		description: "Anchor date. Defaults to today. Mutually exclusive with ref.",
	},
	ref: {
		value: "<ref>",
		description:
			"Human-friendly reference, e.g. 2026-05-11 / 2026/W20 / 2026/Q2 / 2026.",
	},
	format: {
		value: "<text|json>",
		description: "Output format. Default text.",
	},
} as const;

export function registerCliHandlers(plugin: PluginWithSettings): void {
	const deps: CliDeps = {
		app: plugin.app,
		getSettings: () => plugin.settings,
	};

	plugin.registerCliHandler(
		"dnn:path",
		"Resolve a periodic note's vault path. Does not touch the vault.",
		{ ...SELECTOR_FLAGS },
		async (params) => handlePath(deps, params),
	);

	plugin.registerCliHandler(
		"dnn:exists",
		"Check whether a periodic note exists in the vault.",
		{ ...SELECTOR_FLAGS },
		async (params) => handleExists(deps, params),
	);

	plugin.registerCliHandler(
		"dnn:find",
		"Resolve, optionally create, and optionally open a periodic note.",
		{
			...SELECTOR_FLAGS,
			create: {
				description:
					"Create the note if missing, using the configured template.",
			},
			template: {
				value: "<path>",
				description:
					"Override the configured template for this creation. Vault-relative path.",
			},
			open: {
				description:
					"Open the note in the UI after resolving (and optionally creating).",
			},
			newtab: {
				description:
					"With open: open in a new tab instead of reusing the active leaf.",
			},
		},
		async (params) => handleFind(deps, params),
	);
}
