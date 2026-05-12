// DOM rendering for the calendar sidebar view. The pure month-grid math
// lives in ./calendar-grid; this module turns that data plus a set of
// per-cell existence/selection flags into the actual DOM tree.
//
// Click handling is delegated back to the caller via the CalendarCallbacks
// interface so the view layer can open files, swap leaves, and read modifier
// keys without this module needing to know about Obsidian.

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

const WEEKDAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

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
	onMonthPick: () => void;
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

function renderHeader(
	container: HTMLElement,
	vm: CalendarViewModel,
	cb: CalendarCallbacks,
): void {
	const header = container.createDiv({ cls: "dnn-calendar-header" });

	const nav = header.createDiv({ cls: "dnn-calendar-nav" });
	const prev = nav.createEl("button", {
		cls: "dnn-calendar-nav-button",
		attr: { "aria-label": "Previous month" },
	});
	prev.setText("<");
	prev.addEventListener("click", cb.onPrevMonth);

	const monthLabel = nav.createEl("button", {
		cls: "dnn-calendar-month-label",
		attr: { "aria-label": "Pick month" },
	});
	monthLabel.setText(
		`${MONTH_NAMES[vm.displayedMonthIndex]} ${vm.displayedYear}`,
	);
	monthLabel.addEventListener("click", cb.onMonthPick);

	const next = nav.createEl("button", {
		cls: "dnn-calendar-nav-button",
		attr: { "aria-label": "Next month" },
	});
	next.setText(">");
	next.addEventListener("click", cb.onNextMonth);

	const todayBtn = nav.createEl("button", {
		cls: "dnn-calendar-today-button",
	});
	todayBtn.setText("Today");
	todayBtn.addEventListener("click", cb.onToday);

	const periodLinks = header.createDiv({ cls: "dnn-calendar-period-links" });
	const quarter = calendarQuarterOf(vm.displayedMonthIndex);
	const year = vm.displayedYear;

	const quarterLink = periodLinks.createEl("a", {
		cls: "dnn-calendar-quarter-link",
		href: "#",
	});
	quarterLink.setText(`Q${quarter}`);
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
	quarterLink.addEventListener("click", (evt) => {
		evt.preventDefault();
		cb.onQuarterClick(year, quarter, evt);
	});

	const yearLink = periodLinks.createEl("a", {
		cls: "dnn-calendar-year-link",
		href: "#",
	});
	yearLink.setText(String(year));
	if (vm.yearExists(year)) {
		yearLink.addClass("dnn-has-note");
	}
	if (
		vm.active?.period === "yearly" &&
		vm.active.calendarYear === year
	) {
		yearLink.addClass("dnn-current");
	}
	yearLink.addEventListener("click", (evt) => {
		evt.preventDefault();
		cb.onYearClick(year, evt);
	});
}

function renderGrid(
	container: HTMLElement,
	vm: CalendarViewModel,
	cb: CalendarCallbacks,
): void {
	const table = container.createEl("table", { cls: "dnn-calendar-grid" });
	const thead = table.createEl("thead");
	const headerRow = thead.createEl("tr");
	headerRow.createEl("th", { cls: "dnn-calendar-wk-header", text: "WK" });
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
			href: "#",
		});
		if (vm.weekExists(row.isoYear, row.isoWeek)) {
			wkLink.addClass("dnn-has-note");
		}
		wkLink.addEventListener("click", (evt) => {
			evt.preventDefault();
			cb.onWeekClick(row.isoYear, row.isoWeek, evt);
		});

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
				text: String(day.date.getDate()),
				href: "#",
			});
			if (vm.dayExists(day.date)) {
				link.addClass("dnn-has-note");
			}
			const capturedDate = day.date;
			link.addEventListener("click", (evt) => {
				evt.preventDefault();
				cb.onDayClick(capturedDate, evt);
			});
			link.addEventListener("auxclick", (evt) => {
				if (evt.button !== 1) return;
				evt.preventDefault();
				cb.onDayClick(capturedDate, evt);
			});
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
