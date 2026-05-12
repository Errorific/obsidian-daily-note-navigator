// Test-only stand-in for the Templater core. Implements just the slice of
// API the create flow uses: create_running_config, parse_template, and
// the files_with_pending_templates set.

import type { App, TFile } from "obsidian";
import type {
	TemplaterCore,
	TemplaterRunningConfig,
} from "./detect";

export type ParseImpl = (
	config: TemplaterRunningConfig,
	content: string,
) => Promise<string>;

export class FakeTemplater implements TemplaterCore {
	files_with_pending_templates: Set<string>;
	parseImpl: ParseImpl = async (_config, content) => content;
	readonly addedPaths: string[] = [];
	readonly deletedPaths: string[] = [];

	constructor() {
		const set = new Set<string>();
		const origAdd = set.add.bind(set);
		const origDelete = set.delete.bind(set);
		set.add = (path: string) => {
			this.addedPaths.push(path);
			return origAdd(path);
		};
		set.delete = (path: string) => {
			this.deletedPaths.push(path);
			return origDelete(path);
		};
		this.files_with_pending_templates = set;
	}

	create_running_config(
		template_file: TFile | undefined,
		target_file: TFile,
		run_mode: number,
	): TemplaterRunningConfig {
		return { template_file, target_file, run_mode };
	}

	async parse_template(
		config: TemplaterRunningConfig,
		template_content: string,
	): Promise<string> {
		return this.parseImpl(config, template_content);
	}
}

export function installTemplater(app: App, templater: object): void {
	(
		app as unknown as {
			plugins: { plugins: Record<string, { templater: object }> };
		}
	).plugins = {
		plugins: { "templater-obsidian": { templater } },
	};
}
