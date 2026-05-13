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

// Always returns 6 rows. The grid starts at the Monday of the ISO week
// containing the month's 1st, except when the 1st itself is a Monday: in
// that case we shift one week earlier so the top row provides previous-
// month overlap. The 6-row depth then naturally extends one week past
// months whose last day is a Sunday, giving next-month overlap at the
// bottom too. A consistent 6-row height also keeps the sidebar from
// reflowing as the user navigates between months.
const GRID_ROWS = 6;

export function buildMonthGrid(
	displayedYear: number,
	displayedMonthIndex: number,
	today: Date,
): WeekRow[] {
	const firstOfMonth = atLocalNoon(displayedYear, displayedMonthIndex, 1);
	let cursor = mondayContaining(firstOfMonth);
	if (isoWeekdayOf(firstOfMonth) === 1) {
		cursor = atLocalNoon(
			cursor.getFullYear(),
			cursor.getMonth(),
			cursor.getDate() - 7,
		);
	}

	const todayKey = ymdKey(today);
	const rows: WeekRow[] = [];
	for (let r = 0; r < GRID_ROWS; r++) {
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
	return atLocalNoon(
		date.getFullYear(),
		date.getMonth(),
		date.getDate() - (isoWeekdayOf(date) - 1),
	);
}

function isoWeekdayOf(date: Date): number {
	return date.getDay() === 0 ? 7 : date.getDay();
}

function ymdKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
