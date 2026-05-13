// DOM rendering for the calendar sidebar view. The pure month-grid math
// lives in ./calendar-grid; this module turns that data plus a set of
// per-cell existence/selection flags into the actual DOM tree.
//
// Click handling is delegated back to the caller via the CalendarCallbacks
// interface so the view layer can open files, swap leaves, and read modifier
// keys without this module needing to know about Obsidian.

import { setIcon } from "obsidian";
import type { Period } from "../dates/resolver";
import { calendarQuarterOf, type WeekRow } from "./calendar-grid";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface ActiveSelection {
	period: Period;
	// Filled per period. For daily, `date` is the active note's date. For
	// weekly, isoYear+isoWeek. For quarterly, calendarYear+calendarQuarter.
	// For yearly, calendarYear.
	date?: Date;
	isoYear?: number;
	isoWeek?: number;
	calendarYear?: number;
	calendarQuarter?: number;
}

export interface CalendarViewModel {
	displayedYear: number;
	displayedMonthIndex: number;
	rows: WeekRow[];
	dayExists: (date: Date) => boolean;
	weekExists: (isoYear: number, isoWeek: number) => boolean;
	quarterExists: (year: number, quarter: number) => boolean;
	yearExists: (year: number) => boolean;
	active: ActiveSelection | undefined;
}

export interface CalendarCallbacks {
	onDayClick: (date: Date, evt: MouseEvent) => void;
	onWeekClick: (isoYear: number, isoWeek: number, evt: MouseEvent) => void;
	onQuarterClick: (year: number, quarter: number, evt: MouseEvent) => void;
	onYearClick: (year: number, evt: MouseEvent) => void;
	onPrevMonth: () => void;
	onNextMonth: () => void;
	onToday: () => void;
}

export function renderCalendar(
	container: HTMLElement,
	vm: CalendarViewModel,
	cb: CalendarCallbacks,
): void {
	container.empty();
	container.addClass("dnn-calendar");

	renderHeader(container, vm, cb);
	renderGrid(container, vm, cb);
}

// Sidebar leaves consume the first `click` event when they aren't currently
// focused -- the click activates the leaf rather than reaching nested
// handlers, so the user has to click twice to open anything. Listening on
// `mousedown` instead fires before the focus rearrangement and makes every
// click responsive. We only honour the primary (0) and middle (1) buttons.
function onActivate(el: HTMLElement, handler: (evt: MouseEvent) => void): void {
	el.addEventListener("mousedown", (evt) => {
		if (evt.button !== 0 && evt.button !== 1) return;
		evt.preventDefault();
		handler(evt);
	});
}

function renderHeader(
	container: HTMLElement,
	vm: CalendarViewModel,
	cb: CalendarCallbacks,
): void {
	const header = container.createDiv({ cls: "dnn-calendar-header" });
	const year = vm.displayedYear;

	const title = header.createDiv({ cls: "dnn-calendar-title" });
	title.createSpan({
		cls: "dnn-calendar-month",
		text: MONTH_NAMES[vm.displayedMonthIndex],
	});
	const yearLink = title.createEl("a", {
		cls: "dnn-calendar-year-link",
		text: String(year),
	});
	if (vm.yearExists(year)) yearLink.addClass("dnn-has-note");
	if (vm.active?.period === "yearly" && vm.active.calendarYear === year) {
		yearLink.addClass("dnn-current");
	}
	onActivate(yearLink, (evt) => cb.onYearClick(year, evt));

	const actions = header.createDiv({ cls: "dnn-calendar-actions" });
	const prev = actions.createEl("a", {
		cls: "dnn-calendar-icon-button",
		attr: { "aria-label": "Previous month", role: "button" },
	});
	prev.setText("‹");
	onActivate(prev, () => cb.onPrevMonth());

	const todayBtn = actions.createEl("a", {
		cls: "dnn-calendar-icon-button",
		attr: { "aria-label": "Today", role: "button" },
	});
	setIcon(todayBtn, "crosshair");
	onActivate(todayBtn, () => cb.onToday());

	const next = actions.createEl("a", {
		cls: "dnn-calendar-icon-button",
		attr: { "aria-label": "Next month", role: "button" },
	});
	next.setText("›");
	onActivate(next, () => cb.onNextMonth());
}

function renderGrid(
	container: HTMLElement,
	vm: CalendarViewModel,
	cb: CalendarCallbacks,
): void {
	const year = vm.displayedYear;
	const quarter = calendarQuarterOf(vm.displayedMonthIndex);

	const table = container.createEl("table", { cls: "dnn-calendar-grid" });
	const thead = table.createEl("thead");
	const headerRow = thead.createEl("tr");

	const quarterHeader = headerRow.createEl("th", {
		cls: "dnn-calendar-quarter-header",
	});
	const quarterLink = quarterHeader.createEl("a", {
		cls: "dnn-calendar-quarter-link",
		text: `Q${quarter}`,
	});
	if (vm.quarterExists(year, quarter)) {
		quarterLink.addClass("dnn-has-note");
	}
	if (
		vm.active?.period === "quarterly" &&
		vm.active.calendarYear === year &&
		vm.active.calendarQuarter === quarter
	) {
		quarterLink.addClass("dnn-current");
	}
	onActivate(quarterLink, (evt) => cb.onQuarterClick(year, quarter, evt));

	for (const label of WEEKDAY_HEADERS) {
		headerRow.createEl("th", { text: label });
	}

	const tbody = table.createEl("tbody");
	for (const row of vm.rows) {
		const tr = tbody.createEl("tr");
		if (
			vm.active?.period === "weekly" &&
			vm.active.isoYear === row.isoYear &&
			vm.active.isoWeek === row.isoWeek
		) {
			tr.addClass("dnn-current-week");
		}

		const wkCell = tr.createEl("td", { cls: "dnn-calendar-week-cell" });
		const wkLink = wkCell.createEl("a", {
			cls: "dnn-calendar-week-link",
			text: String(row.isoWeek).padStart(2, "0"),
		});
		if (vm.weekExists(row.isoYear, row.isoWeek)) {
			wkLink.addClass("dnn-has-note");
		}
		onActivate(wkLink, (evt) => cb.onWeekClick(row.isoYear, row.isoWeek, evt));

		for (const day of row.days) {
			const td = tr.createEl("td", { cls: "dnn-calendar-day-cell" });
			if (!day.inDisplayedMonth) td.addClass("dnn-adjacent-month");
			if (day.isToday) td.addClass("dnn-today");
			if (
				vm.active?.period === "daily" &&
				vm.active.date !== undefined &&
				sameDay(vm.active.date, day.date)
			) {
				td.addClass("dnn-current");
			}
			const link = td.createEl("a", {
				cls: "dnn-calendar-day-link",
				text: String(day.date.getDate()).padStart(2, "0"),
			});
			if (vm.dayExists(day.date)) {
				link.addClass("dnn-has-note");
			}
			const capturedDate = day.date;
			onActivate(link, (evt) => cb.onDayClick(capturedDate, evt));
		}
	}
}

function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}
