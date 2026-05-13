import { Plugin, type WorkspaceLeaf } from "obsidian";
import { registerCliHandlers } from "./cli/register";
import { registerCommands } from "./commands/register";
import { DEFAULT_SETTINGS, Settings } from "./settings";
import { CALENDAR_VIEW_TYPE, CalendarView } from "./ui/calendar-view";
import { SettingsTab } from "./ui/settings-tab";

export default class DailyNoteNavigator extends Plugin {
	settings!: Settings;

	async onload() {
		await this.loadSettings();
		registerCliHandlers(this);
		registerCommands(this);

		this.registerView(
			CALENDAR_VIEW_TYPE,
			(leaf) => new CalendarView(leaf, this),
		);

		this.addCommand({
			id: "show-calendar",
			name: "Show calendar",
			callback: () => {
				void this.revealCalendar();
			},
		});

		this.addSettingTab(new SettingsTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			void this.ensureCalendarLeaf();
		});
	}

	private async ensureCalendarLeaf(): Promise<void> {
		if (this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE).length > 0) {
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf === null) return;
		await leaf.setViewState({ type: CALENDAR_VIEW_TYPE, active: false });
	}

	onunload() {}

	private async revealCalendar(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE);
		let leaf: WorkspaceLeaf | null;
		if (existing.length > 0) {
			leaf = existing[0] ?? null;
		} else {
			leaf = this.app.workspace.getRightLeaf(false);
			if (leaf !== null) {
				await leaf.setViewState({ type: CALENDAR_VIEW_TYPE, active: true });
			}
		}
		if (leaf !== null) {
			await this.app.workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		const stored = (await this.loadData()) as Partial<Settings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
