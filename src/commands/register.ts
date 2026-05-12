// Registers the command palette entries listed in docs/design/commands.md.
// Each "open X" command is a thin wrapper over the Phase 5 createNote flow
// followed by workspace.openFile. Pick-date and pick-period-note prompt the
// user through a small modal first.
//
// No default hotkeys: the design doc explicitly avoids them.

import {
	App,
	Modal,
	Notice,
	type Plugin,
	Setting,
	type TFile,
} from "obsidian";
import { recognizePath } from "../dates/recognize";
import { parseRef } from "../dates/refs";
import { type Period, formatIsoDate, resolve } from "../dates/resolver";
import { type Direction, stepAnchor } from "../dates/step";
import type { Settings } from "../settings";
import { createNote } from "../templater/create";

export interface PluginWithSettings extends Plugin {
	settings: Settings;
}

const PERIODS: ReadonlyArray<Period> = [
	"daily",
	"weekly",
	"quarterly",
	"yearly",
];

const PERIOD_LABELS: Record<Period, string> = {
	daily: "Daily",
	weekly: "Weekly",
	quarterly: "Quarterly",
	yearly: "Yearly",
};

export function registerCommands(plugin: PluginWithSettings): void {
	plugin.addCommand({
		id: "open-today",
		name: "Open today's daily note",
		callback: () => {
			void openForAnchor(plugin, todayAtNoon(), "daily");
		},
	});

	plugin.addCommand({
		id: "open-this-week",
		name: "Open this week's weekly note",
		callback: () => {
			void openForAnchor(plugin, todayAtNoon(), "weekly");
		},
	});

	plugin.addCommand({
		id: "open-this-quarter",
		name: "Open this quarter's quarterly note",
		callback: () => {
			void openForAnchor(plugin, todayAtNoon(), "quarterly");
		},
	});

	plugin.addCommand({
		id: "open-this-year",
		name: "Open this year's yearly note",
		callback: () => {
			void openForAnchor(plugin, todayAtNoon(), "yearly");
		},
	});

	plugin.addCommand({
		id: "open-previous",
		name: "Open previous note (for current period)",
		callback: () => {
			void openPrevNext(plugin, -1);
		},
	});

	plugin.addCommand({
		id: "open-next",
		name: "Open next note (for current period)",
		callback: () => {
			void openPrevNext(plugin, 1);
		},
	});

	plugin.addCommand({
		id: "pick-date",
		name: "Open daily note for date...",
		callback: () => {
			new PickDateModal(plugin.app, formatIsoDate(todayAtNoon()), (date) => {
				try {
					const anchor = parseRef(date, "daily");
					void openForAnchor(plugin, anchor, "daily");
				} catch (err) {
					notify(messageOf(err));
				}
			}).open();
		},
	});

	plugin.addCommand({
		id: "pick-period-note",
		name: "Open periodic note...",
		callback: () => {
			new PickPeriodNoteModal(plugin.app, (period, ref) => {
				try {
					const anchor = ref.trim() === ""
						? todayAtNoon()
						: parseRef(ref.trim(), period);
					void openForAnchor(plugin, anchor, period);
				} catch (err) {
					notify(messageOf(err));
				}
			}).open();
		},
	});
}

async function openForAnchor(
	plugin: PluginWithSettings,
	anchor: Date,
	period: Period,
): Promise<void> {
	const resolved = resolve(anchor, period);
	const templatePath = plugin.settings.templates[period];
	let file: TFile;
	try {
		file = await createNote(plugin.app, resolved, {
			anchor,
			period,
			templatePath,
		});
	} catch (err) {
		notify(messageOf(err));
		return;
	}
	const leaf = plugin.app.workspace.getLeaf(false);
	await leaf.openFile(file);
}

async function openPrevNext(
	plugin: PluginWithSettings,
	direction: Direction,
): Promise<void> {
	const active = plugin.app.workspace.getActiveFile();
	if (active === null) {
		notify("No active file. Open a periodic note first.");
		return;
	}
	const recognized = recognizePath(active.path);
	if (recognized === undefined) {
		notify(
			`'${active.path}' is not a recognised periodic note (expected Journal/...).`,
		);
		return;
	}
	const nextAnchor = stepAnchor(recognized.anchor, recognized.period, direction);
	await openForAnchor(plugin, nextAnchor, recognized.period);
}

function todayAtNoon(): Date {
	const now = new Date();
	return new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		12,
		0,
		0,
		0,
	);
}

function notify(message: string): void {
	new Notice(`Daily Note Navigator: ${message}`);
}

function messageOf(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

class PickDateModal extends Modal {
	private date: string;
	private readonly onSubmit: (date: string) => void;

	constructor(
		app: App,
		defaultDate: string,
		onSubmit: (date: string) => void,
	) {
		super(app);
		this.date = defaultDate;
		this.onSubmit = onSubmit;
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "Open daily note for date" });

		new Setting(contentEl).setName("Date").addText((text) => {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text.setPlaceholder("yyyy-mm-dd")
				.setValue(this.date)
				.onChange((value) => {
					this.date = value;
				});
			text.inputEl.type = "date";
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Open")
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit(this.date);
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}

class PickPeriodNoteModal extends Modal {
	private period: Period = "daily";
	private ref = "";
	private readonly onSubmit: (period: Period, ref: string) => void;

	constructor(app: App, onSubmit: (period: Period, ref: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "Open periodic note" });

		const refSetting = new Setting(contentEl).setName("Date or reference");
		const updateRefDesc = () => {
			refSetting.setDesc(refPlaceholder(this.period));
		};

		new Setting(contentEl).setName("Period").addDropdown((drop) => {
			for (const period of PERIODS) {
				drop.addOption(period, PERIOD_LABELS[period]);
			}
			drop.setValue(this.period).onChange((value) => {
				this.period = value as Period;
				updateRefDesc();
			});
		});

		refSetting.addText((text) => {
			text.setPlaceholder(refPlaceholder(this.period))
				.setValue(this.ref)
				.onChange((value) => {
					this.ref = value;
				});
		});
		updateRefDesc();

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Open")
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit(this.period, this.ref);
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}

function refPlaceholder(period: Period): string {
	switch (period) {
		case "daily":
			return "yyyy-mm-dd (blank = today)";
		case "weekly":
			return "yyyy/Www (blank = current week)";
		case "quarterly":
			return "yyyy/Qq (blank = current quarter)";
		case "yearly":
			return "yyyy (blank = current year)";
		default: {
			const exhaustive: never = period;
			throw new Error(`Unknown period: ${String(exhaustive)}`);
		}
	}
}
