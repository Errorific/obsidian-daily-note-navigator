// Parser for human-friendly period references (`2026-05-11`, `2026/W20`, etc.)
// used by the CLI's `ref=` flag.
//
// Accepted formats per period come from the "Selector parameters" table in
// docs/design/cli-surface.md. The parser turns a (ref, period) pair into an
// anchor Date that, when passed to resolve() from ./resolver, produces the
// expected folder/filename for the period.
//
// Parsed anchors are intentionally mid-period (mid-month for quarterly,
// July 1 for yearly) so the anchor's ISO week-year and calendar quarter
// agree with the user's request even at year boundaries. See the worked
// rationale in docs/design/folder-layout.md ("Edge cases and open questions").

import { type Period, isoWeekOf, mondayOfIsoWeek } from "./resolver";

export interface ParsedRef {
	anchor: Date;
	period: Period;
}

export function parseRef(ref: string, period: Period): Date {
	switch (period) {
		case "daily":
			return parseDailyRef(ref);
		case "weekly":
			return parseWeeklyRef(ref);
		case "quarterly":
			return parseQuarterlyRef(ref);
		case "yearly":
			return parseYearlyRef(ref);
		default: {
			const exhaustive: never = period;
			throw new Error(`Unknown period: ${String(exhaustive)}`);
		}
	}
}

function parseDailyRef(ref: string): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ref);
	if (!match) {
		throw invalidRef(ref, "daily");
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = atLocalNoon(year, month - 1, day);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		throw invalidRef(ref, "daily");
	}
	return date;
}

function parseWeeklyRef(ref: string): Date {
	const match = /^(\d{4})[/-]W(\d{1,2})$/.exec(ref);
	if (!match) {
		throw invalidRef(ref, "weekly");
	}
	const year = Number(match[1]);
	const week = Number(match[2]);
	if (week < 1 || week > 53) {
		throw invalidRef(ref, "weekly");
	}
	const monday = mondayOfIsoWeek(year, week);
	const check = isoWeekOf(monday);
	if (check.year !== year || check.week !== week) {
		// Year does not have this ISO week (e.g. 2025 has no W53).
		throw invalidRef(ref, "weekly");
	}
	return monday;
}

function parseQuarterlyRef(ref: string): Date {
	const match = /^(\d{4})[/-]Q([1-4])$/.exec(ref);
	if (!match) {
		throw invalidRef(ref, "quarterly");
	}
	const year = Number(match[1]);
	const quarter = Number(match[2]);
	// Mid-month of the middle month of the quarter: Feb 15 / May 15 / Aug 15 / Nov 15.
	const monthIndex = (quarter - 1) * 3 + 1;
	return atLocalNoon(year, monthIndex, 15);
}

function parseYearlyRef(ref: string): Date {
	const match = /^(\d{4})$/.exec(ref);
	if (!match) {
		throw invalidRef(ref, "yearly");
	}
	const year = Number(match[1]);
	return atLocalNoon(year, 6, 1);
}

function atLocalNoon(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function invalidRef(ref: string, period: Period): Error {
	return new Error(`ref '${ref}' is not valid for period '${period}'`);
}
