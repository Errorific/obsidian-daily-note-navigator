// Builds the marker context that fills `{{dnn.*}}` in template content.
// Pure, no Obsidian imports. See docs/design/templates.md for the marker
// table and the per-period canonical anchor rules.

import {
	type Period,
	type Resolved,
	formatIsoDate,
	isoWeekOf,
	mondayOfIsoWeek,
	quarterOfWeek,
} from "../dates/resolver";

export interface Context {
	period: Period;
	year: string;
	quarter: string;
	week: string;
	anchor_date: string;
	folder: string;
	filename: string;
	path: string;
}

export function buildContext(
	anchor: Date,
	period: Period,
	resolved: Resolved,
): Context {
	const { year, week } = isoWeekOf(anchor);
	const { quarter } = quarterOfWeek(anchor);
	return {
		period,
		year: String(year),
		quarter: String(quarter),
		week: String(week).padStart(2, "0"),
		anchor_date: canonicalAnchorDate(anchor, period, year, week, quarter),
		folder: resolved.folder,
		filename: stripMdExt(resolved.filename),
		path: resolved.path,
	};
}

function canonicalAnchorDate(
	anchor: Date,
	period: Period,
	year: number,
	week: number,
	quarter: number,
): string {
	switch (period) {
		case "daily":
			return formatIsoDate(anchor);
		case "weekly":
			return formatIsoDate(mondayOfIsoWeek(year, week));
		case "quarterly":
			return formatIsoDate(firstThursdayOfQuarter(year, quarter));
		case "yearly":
			return formatIsoDate(new Date(year, 6, 1, 12, 0, 0, 0));
		default: {
			const exhaustive: never = period;
			throw new Error(`Unknown period: ${String(exhaustive)}`);
		}
	}
}

// First Thursday in the first month of the calendar quarter. Because ISO
// week-year is determined by a week's Thursday, this anchor is guaranteed
// to round-trip through resolve(): the year and quarter it implies always
// match the requested ones, even when Jan 1 of `year` falls in the prior
// ISO week-year (e.g. 2027/Q1 anchors at 2027-01-07, not 2027-01-01).
function firstThursdayOfQuarter(year: number, quarter: number): Date {
	const startMonth = (quarter - 1) * 3;
	const firstOfQuarter = new Date(year, startMonth, 1, 12, 0, 0, 0);
	const isoWeekday = firstOfQuarter.getDay() === 0 ? 7 : firstOfQuarter.getDay();
	const offset = (4 - isoWeekday + 7) % 7;
	return new Date(year, startMonth, 1 + offset, 12, 0, 0, 0);
}

function stripMdExt(filename: string): string {
	return filename.replace(/\.md$/, "");
}
