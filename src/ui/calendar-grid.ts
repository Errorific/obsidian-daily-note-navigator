// Pure month-grid math for the calendar sidebar view.
//
// Given a displayed calendar month (year + 0-based month index), this returns
// the rows the calendar grid renders: one row per ISO week that intersects the
// month, each row Mon..Sun, marking cells that fall outside the displayed
// month and the one cell (if any) that is today.
//
// No Obsidian imports: this module is unit-tested in a plain Node runner.
// See docs/design/calendar-sidebar.md for the layout this feeds.

import { isoWeekOf } from "../dates/resolver";

export interface DayCell {
	date: Date;
	inDisplayedMonth: boolean;
	isToday: boolean;
}

export interface WeekRow {
	// ISO week-year and ISO week number for the row. These come from the
	// Thursday rule, so for a row whose Mon-Wed fall in the previous calendar
	// year and Thu-Sun in the new one (or vice versa), this still names the
	// single ISO week the row represents.
	isoYear: number;
	isoWeek: number;
	days: DayCell[];
}

export function buildMonthGrid(
	displayedYear: number,
	displayedMonthIndex: number,
	today: Date,
): WeekRow[] {
	const firstOfMonth = atLocalNoon(displayedYear, displayedMonthIndex, 1);
	// Day 0 of next month = last day of this month.
	const lastOfMonth = atLocalNoon(displayedYear, displayedMonthIndex + 1, 0);

	const firstMonday = mondayContaining(firstOfMonth);
	const todayKey = ymdKey(today);

	const rows: WeekRow[] = [];
	let cursor = firstMonday;
	// Inclusive: keep building rows while the row's Monday is on or before
	// the month's last day. The last row may extend into the next month --
	// those cells are dimmed but still clickable.
	while (cursor.getTime() <= lastOfMonth.getTime()) {
		const days: DayCell[] = [];
		for (let i = 0; i < 7; i++) {
			const date = atLocalNoon(
				cursor.getFullYear(),
				cursor.getMonth(),
				cursor.getDate() + i,
			);
			days.push({
				date,
				inDisplayedMonth:
					date.getFullYear() === displayedYear &&
					date.getMonth() === displayedMonthIndex,
				isToday: ymdKey(date) === todayKey,
			});
		}
		const { year, week } = isoWeekOf(cursor);
		rows.push({ isoYear: year, isoWeek: week, days });
		cursor = atLocalNoon(
			cursor.getFullYear(),
			cursor.getMonth(),
			cursor.getDate() + 7,
		);
	}
	return rows;
}

// Calendar quarter (1..4) of a displayed month. Distinct from ISO quarter:
// the header in the calendar view shows the *calendar* quarter of the month,
// while each row's week link follows the ISO Thursday rule.
export function calendarQuarterOf(monthIndex: number): number {
	return Math.floor(monthIndex / 3) + 1;
}

// Step the displayed month, normalising year rollovers.
export function stepMonth(
	year: number,
	monthIndex: number,
	delta: number,
): { year: number; monthIndex: number } {
	const total = year * 12 + monthIndex + delta;
	const newYear = Math.floor(total / 12);
	const newMonth = total - newYear * 12;
	return { year: newYear, monthIndex: newMonth };
}

function atLocalNoon(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function mondayContaining(date: Date): Date {
	const isoWeekday = date.getDay() === 0 ? 7 : date.getDay();
	return atLocalNoon(
		date.getFullYear(),
		date.getMonth(),
		date.getDate() - (isoWeekday - 1),
	);
}

function ymdKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
