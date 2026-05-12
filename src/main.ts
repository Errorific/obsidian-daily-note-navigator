import { Plugin } from "obsidian";
import { registerCliHandlers } from "./cli/register";
import { DEFAULT_SETTINGS, Settings } from "./settings";

export default class DailyNoteNavigator extends Plugin {
	settings!: Settings;

	async onload() {
		await this.loadSettings();
		registerCliHandlers(this);
	}

	onunload() {}

	async loadSettings() {
		const stored = (await this.loadData()) as Partial<Settings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
