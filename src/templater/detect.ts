// Runtime detection and narrow typing of the Templater plugin's internal
// core. Templater is a soft dependency (see docs/decisions/2026-05-11-
// templater-soft-dependency.md): if the plugin is absent we fall back to
// writing template content verbatim.
//
// We rely on Templater's internal API rather than a documented public
// surface; this module isolates that coupling. See docs/design/templates.md
// for the call sequence we follow.

import type { App, TFile } from "obsidian";

// RunMode is an unexported enum in Templater's core. We need to pass
// CreateNewFromTemplate (value 0) into create_running_config. Mirroring the
// value here keeps the dependency local to this module.
export const TEMPLATER_RUN_MODE_CREATE_NEW_FROM_TEMPLATE = 0;

export interface TemplaterRunningConfig {
	template_file: TFile | undefined;
	target_file: TFile;
	run_mode: number;
	active_file?: TFile | null;
}

export interface TemplaterCore {
	files_with_pending_templates: Set<string>;
	create_running_config(
		template_file: TFile | undefined,
		target_file: TFile,
		run_mode: number,
	): TemplaterRunningConfig;
	parse_template(
		config: TemplaterRunningConfig,
		template_content: string,
	): Promise<string>;
}

interface AppWithPlugins {
	plugins?: {
		plugins?: Record<string, { templater?: TemplaterCore } | undefined>;
	};
}

let warnedAboutMissingPendingSet = false;

export function getTemplater(app: App): TemplaterCore | undefined {
	const registry = (app as App & AppWithPlugins).plugins?.plugins;
	const templater = registry?.["templater-obsidian"]?.templater;
	if (templater === undefined) {
		return undefined;
	}
	if (
		!(templater.files_with_pending_templates instanceof Set) &&
		!warnedAboutMissingPendingSet
	) {
		warnedAboutMissingPendingSet = true;
		console.warn(
			"Daily Note Navigator: Templater's files_with_pending_templates set is unavailable; folder-template guard will be skipped.",
		);
	}
	return templater;
}

export function hasPendingSet(templater: TemplaterCore): boolean {
	return templater.files_with_pending_templates instanceof Set;
}

// Test-only: reset the once-per-session warn flag.
export function _resetWarningStateForTests(): void {
	warnedAboutMissingPendingSet = false;
}
