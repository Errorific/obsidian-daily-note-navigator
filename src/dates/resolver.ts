// Pure date-to-path resolver for periodic notes.
//
// See docs/design/folder-layout.md for the mapping rules and worked examples,
// and docs/decisions/2026-05-11-iso-week-period-boundaries.md for the Thursday
// rule that determines a week's containing year and quarter.
//
// No Obsidian imports: this module must be importable in a plain Node runner.

export type Period = "daily" | "weekly" | "quarterly" | "yearly";

export interface Resolved {
	folder: string;
	filename: string;
	path: string;
}

const DEFAULT_ROOT = "Journal";

export function resolve(
	anchor: Date,
	period: Period,
	root: string = DEFAULT_ROOT,
): Resolved {
	const { year, week } = isoWeekOf(anchor);
	const { quarter } = quarterOfWeek(anchor);

	const yearStr = String(year);
	const weekStr = String(week).padStart(2, "0");

	let folder: string;
	let filename: string;

	switch (period) {
		case "daily":
			folder = `${root}/${yearStr}/Q${quarter}/W${weekStr}`;
			filename = `${formatIsoDate(anchor)}.md`;
			break;
		case "weekly":
			folder = `${root}/${yearStr}/Q${quarter}/W${weekStr}`;
			filename = `W${weekStr}.md`;
			break;
		case "quarterly":
			folder = `${root}/${yearStr}/Q${quarter}`;
			filename = `Q${quarter}.md`;
			break;
		case "yearly":
			folder = `${root}/${yearStr}`;
			filename = `${yearStr}.md`;
			break;
		default: {
			const exhaustive: never = period;
			throw new Error(`Unknown period: ${String(exhaustive)}`);
		}
	}

	return { folder, filename, path: `${folder}/${filename}` };
}

export function isoWeekOf(date: Date): { year: number; week: number } {
	const thursday = thursdayOfIsoWeek(date);
	const year = thursday.getFullYear();
	const jan1 = atLocalNoon(year, 0, 1);
	const dayOfYear =
		Math.round((thursday.getTime() - jan1.getTime()) / MS_PER_DAY) + 1;
	const week = Math.floor((dayOfYear - 1) / 7) + 1;
	return { year, week };
}

export function quarterOfWeek(date: Date): { year: number; quarter: number } {
	const thursday = thursdayOfIsoWeek(date);
	return {
		year: thursday.getFullYear(),
		quarter: Math.floor(thursday.getMonth() / 3) + 1,
	};
}

const MS_PER_DAY = 86_400_000;

// Returns a new Date at local noon on the Thursday of the ISO week containing
// `date`. Noon avoids DST-transition edge cases when subtracting epoch times.
function thursdayOfIsoWeek(date: Date): Date {
	const isoWeekday = isoWeekdayOf(date);
	const offset = 4 - isoWeekday;
	return atLocalNoon(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

// ISO weekday: Mon = 1 .. Sun = 7.
function isoWeekdayOf(date: Date): number {
	const day = date.getDay();
	return day === 0 ? 7 : day;
}

function atLocalNoon(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

// Returns the Monday of ISO week `week` of ISO week-year `year`. Caller is
// responsible for round-tripping through isoWeekOf to validate that the week
// exists in that year (e.g. 2025 has no W53).
export function mondayOfIsoWeek(year: number, week: number): Date {
	const jan4 = atLocalNoon(year, 0, 4);
	const jan4IsoDay = jan4.getDay() === 0 ? 7 : jan4.getDay();
	return atLocalNoon(year, 0, 4 - (jan4IsoDay - 1) + (week - 1) * 7);
}

export function formatIsoDate(date: Date): string {
	const y = String(date.getFullYear()).padStart(4, "0");
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}
