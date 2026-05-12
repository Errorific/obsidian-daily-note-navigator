// The right-sidebar calendar. See docs/design/calendar-sidebar.md.
//
// State held by the view is just the displayed (year, monthIndex). Existence
// and selection state are derived on each render from the current vault and
// active file. Re-rendering on vault/workspace events is cheap (~42 path
// lookups), so we re-render in full rather than diff cells.

import {
	type App,
	ItemView,
	Modal,
	Notice,
	Setting,
	type TFile,
	type WorkspaceLeaf,
	debounce,
} from "obsidian";
import { recognizePath } from "../dates/recognize";
import {
	type Period,
	isoWeekOf,
	resolve,
} from "../dates/resolver";
import type { PluginWithSettings } from "../commands/register";
import { createNote } from "../templater/create";
import {
	buildMonthGrid,
	calendarQuarterOf,
	stepMonth,
} from "./calendar-grid";
import {
	type ActiveSelection,
	type CalendarViewModel,
	renderCalendar,
} from "./calendar-render";

export const CALENDAR_VIEW_TYPE = "daily-note-navigator:calendar";

const JOURNAL_ROOT_PREFIX = "Journal/";

export class CalendarView extends ItemView {
	private displayedYear: number;
	private displayedMonthIndex: number;
	private readonly plugin: PluginWithSettings;
	private readonly scheduleRender: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: PluginWithSettings) {
		super(leaf);
		this.plugin = plugin;
		const today = new Date();
		this.displayedYear = today.getFullYear();
		this.displayedMonthIndex = today.getMonth();
		this.scheduleRender = debounce(() => this.render(), 50, true);
	}

	override getViewType(): string {
		return CALENDAR_VIEW_TYPE;
	}

	override getDisplayText(): string {
		return "Daily note navigator";
	}

	override getIcon(): string {
		return "calendar-days";
	}

	override async onOpen(): Promise<void> {
		this.render();

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file.path.startsWith(JOURNAL_ROOT_PREFIX)) this.scheduleRender();
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file.path.startsWith(JOURNAL_ROOT_PREFIX)) this.scheduleRender();
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (
					file.path.startsWith(JOURNAL_ROOT_PREFIX) ||
					oldPath.startsWith(JOURNAL_ROOT_PREFIX)
				) {
					this.scheduleRender();
				}
			}),
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.scheduleRender();
			}),
		);
	}

	override async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private render(): void {
		const today = todayAtNoon();
		const rows = buildMonthGrid(
			this.displayedYear,
			this.displayedMonthIndex,
			today,
		);
		const vm: CalendarViewModel = {
			displayedYear: this.displayedYear,
			displayedMonthIndex: this.displayedMonthIndex,
			rows,
			dayExists: (date) => existsAt(this.app, resolve(date, "daily").path),
			weekExists: (isoYear, isoWeek) =>
				existsAt(
					this.app,
					weeklyPathFor(isoYear, isoWeek, rows),
				),
			quarterExists: (year, quarter) =>
				existsAt(this.app, resolve(anchorForQuarter(year, quarter), "quarterly").path),
			yearExists: (year) =>
				existsAt(this.app, resolve(anchorForYear(year), "yearly").path),
			active: detectActiveSelection(this.app),
		};

		renderCalendar(this.contentEl, vm, {
			onDayClick: (date, evt) => {
				void this.openPeriodic(date, "daily", evt);
			},
			onWeekClick: (isoYear, isoWeek, evt) => {
				const anchor = anchorForIsoWeek(isoYear, isoWeek, rows);
				void this.openPeriodic(anchor, "weekly", evt);
			},
			onQuarterClick: (year, quarter, evt) => {
				void this.openPeriodic(anchorForQuarter(year, quarter), "quarterly", evt);
			},
			onYearClick: (year, evt) => {
				void this.openPeriodic(anchorForYear(year), "yearly", evt);
			},
			onPrevMonth: () => this.stepDisplayed(-1),
			onNextMonth: () => this.stepDisplayed(1),
			onToday: () => {
				const t = new Date();
				this.displayedYear = t.getFullYear();
				this.displayedMonthIndex = t.getMonth();
				this.render();
			},
			onMonthPick: () => {
				new PickMonthModal(
					this.app,
					this.displayedYear,
					this.displayedMonthIndex,
					(year, monthIndex) => {
						this.displayedYear = year;
						this.displayedMonthIndex = monthIndex;
						this.render();
					},
				).open();
			},
		});
	}

	private stepDisplayed(delta: number): void {
		const stepped = stepMonth(this.displayedYear, this.displayedMonthIndex, delta);
		this.displayedYear = stepped.year;
		this.displayedMonthIndex = stepped.monthIndex;
		this.render();
	}

	private async openPeriodic(
		anchor: Date,
		period: Period,
		evt: MouseEvent,
	): Promise<void> {
		const resolved = resolve(anchor, period);
		const templatePath = this.plugin.settings.templates[period];
		let file: TFile;
		try {
			file = await createNote(this.app, resolved, {
				anchor,
				period,
				templatePath,
			});
		} catch (err) {
			notify(messageOf(err));
			return;
		}
		const newTab = evt.ctrlKey || evt.metaKey || evt.button === 1;
		const leaf = newTab
			? this.app.workspace.getLeaf("tab")
			: this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}
}

function existsAt(app: App, path: string): boolean {
	return app.vault.getAbstractFileByPath(path) !== null;
}

// The grid already knows the Monday date for each row, so reuse it rather
// than recomputing. Returns the weekly note path for the row whose ISO
// (year, week) matches.
function weeklyPathFor(
	isoYear: number,
	isoWeek: number,
	rows: ReturnType<typeof buildMonthGrid>,
): string {
	return resolve(anchorForIsoWeek(isoYear, isoWeek, rows), "weekly").path;
}

function anchorForIsoWeek(
	isoYear: number,
	isoWeek: number,
	rows: ReturnType<typeof buildMonthGrid>,
): Date {
	for (const row of rows) {
		if (row.isoYear === isoYear && row.isoWeek === isoWeek) {
			const monday = row.days[0]?.date;
			if (monday !== undefined) return monday;
		}
	}
	// Fallback: any day will resolve to the same week via the Thursday rule.
	return new Date(isoYear, 0, 4, 12, 0, 0, 0);
}

// For header navigation we want the calendar quarter/year, not the ISO one.
// Using a mid-quarter / mid-year anchor lines up the resolver's Thursday-rule
// quarter and year with the user's calendar-based intent. Same convention as
// parseRef in src/dates/refs.ts.
function anchorForQuarter(year: number, quarter: number): Date {
	return new Date(year, (quarter - 1) * 3 + 1, 15, 12, 0, 0, 0);
}

function anchorForYear(year: number): Date {
	return new Date(year, 6, 1, 12, 0, 0, 0);
}

function detectActiveSelection(app: App): ActiveSelection | undefined {
	const active = app.workspace.getActiveFile();
	if (active === null) return undefined;
	const recognized = recognizePath(active.path);
	if (recognized === undefined) return undefined;
	const { period, anchor } = recognized;
	switch (period) {
		case "daily":
			return { period, date: anchor };
		case "weekly": {
			const { year, week } = isoWeekOf(anchor);
			return { period, isoYear: year, isoWeek: week };
		}
		case "quarterly":
			return {
				period,
				calendarYear: anchor.getFullYear(),
				calendarQuarter: calendarQuarterOf(anchor.getMonth()),
			};
		case "yearly":
			return { period, calendarYear: anchor.getFullYear() };
		default: {
			const exhaustive: never = period;
			throw new Error(`Unknown period: ${String(exhaustive)}`);
		}
	}
}

function todayAtNoon(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}

function notify(message: string): void {
	new Notice(`Daily Note Navigator: ${message}`);
}

function messageOf(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

class PickMonthModal extends Modal {
	private value: string;
	private readonly onSubmit: (year: number, monthIndex: number) => void;

	constructor(
		app: App,
		year: number,
		monthIndex: number,
		onSubmit: (year: number, monthIndex: number) => void,
	) {
		super(app);
		this.value = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
		this.onSubmit = onSubmit;
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "Jump to month" });

		new Setting(contentEl).setName("Month").addText((text) => {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			text.setPlaceholder("yyyy-mm")
				.setValue(this.value)
				.onChange((value) => {
					this.value = value;
				});
			text.inputEl.type = "month";
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Go")
					.setCta()
					.onClick(() => {
						const match = /^(\d{4})-(\d{2})$/.exec(this.value);
						if (!match) {
							notify("enter a date as yyyy-mm");
							return;
						}
						const year = Number(match[1]);
						const month = Number(match[2]);
						if (month < 1 || month > 12) {
							notify("month must be 01-12");
							return;
						}
						this.close();
						this.onSubmit(year, month - 1);
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
