// Inverse of resolve(): given a vault-relative path, identify which periodic
// note (if any) it represents and return an anchor Date the resolver would
// map back to that same folder.
//
// Used by the previous/next command palette commands so they can detect the
// active file's period without parsing settings or maintaining state.

import {
	type Period,
	dayNameOf,
	isoWeekOf,
	mondayOfIsoWeek,
} from "./resolver";

export interface Recognized {
	period: Period;
	anchor: Date;
}

const DEFAULT_ROOT = "Journal";

const DAILY_FILENAME = /^(\d{4})-(\d{2})-(\d{2}) ([A-Za-z]+)\.md$/;
const WEEKLY_FILENAME = /^W(\d{2})\.md$/;
const QUARTERLY_FILENAME = /^Q([1-4])\.md$/;
const YEARLY_FILENAME = /^(\d{4})\.md$/;
const YEAR_FOLDER = /^\d{4}$/;
const QUARTER_FOLDER = /^Q([1-4])$/;
const WEEK_FOLDER = /^W(\d{2})$/;

export function recognizePath(
	path: string,
	root: string = DEFAULT_ROOT,
): Recognized | undefined {
	const parts = path.split("/");
	if (parts.length < 2 || parts[0] !== root) {
		return undefined;
	}
	const filename = parts[parts.length - 1] ?? "";

	if (parts.length === 5) {
		const yearFolder = parts[1];
		const quarterFolder = parts[2];
		const weekFolder = parts[3];
		if (
			yearFolder === undefined ||
			quarterFolder === undefined ||
			weekFolder === undefined
		) {
			return undefined;
		}

		const dailyMatch = DAILY_FILENAME.exec(filename);
		if (dailyMatch) {
			return recognizeDaily(yearFolder, quarterFolder, weekFolder, dailyMatch);
		}
	}

	if (parts.length === 4) {
		const yearFolder = parts[1];
		const quarterFolder = parts[2];
		if (yearFolder === undefined || quarterFolder === undefined) {
			return undefined;
		}
		const weeklyMatch = WEEKLY_FILENAME.exec(filename);
		if (weeklyMatch) {
			return recognizeWeekly(yearFolder, quarterFolder, weeklyMatch);
		}
	}

	if (parts.length === 3) {
		const yearFolder = parts[1];
		if (yearFolder === undefined) {
			return undefined;
		}
		const quarterlyMatch = QUARTERLY_FILENAME.exec(filename);
		if (quarterlyMatch) {
			return recognizeQuarterly(yearFolder, quarterlyMatch);
		}
	}

	if (parts.length === 2) {
		const yearlyMatch = YEARLY_FILENAME.exec(filename);
		if (yearlyMatch) {
			return recognizeYearly(yearlyMatch);
		}
	}

	return undefined;
}

function recognizeDaily(
	yearFolder: string,
	quarterFolder: string,
	weekFolder: string,
	match: RegExpExecArray,
): Recognized | undefined {
	if (
		!YEAR_FOLDER.test(yearFolder) ||
		!QUARTER_FOLDER.test(quarterFolder) ||
		!WEEK_FOLDER.test(weekFolder)
	) {
		return undefined;
	}
	const yearStr = match[1];
	const monthStr = match[2];
	const dayStr = match[3];
	const dayNameStr = match[4];
	if (
		yearStr === undefined ||
		monthStr === undefined ||
		dayStr === undefined ||
		dayNameStr === undefined
	) {
		return undefined;
	}
	const year = Number(yearStr);
	const month = Number(monthStr);
	const day = Number(dayStr);
	const date = atLocalNoon(year, month - 1, day);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return undefined;
	}
	if (dayNameStr !== dayNameOf(date)) {
		return undefined;
	}
	return { period: "daily", anchor: date };
}

function recognizeWeekly(
	yearFolder: string,
	quarterFolder: string,
	match: RegExpExecArray,
): Recognized | undefined {
	if (!YEAR_FOLDER.test(yearFolder) || !QUARTER_FOLDER.test(quarterFolder)) {
		return undefined;
	}
	const filenameWeekStr = match[1];
	if (filenameWeekStr === undefined) {
		return undefined;
	}
	const year = Number(yearFolder);
	const week = Number(filenameWeekStr);
	if (week < 1 || week > 53) {
		return undefined;
	}
	const monday = mondayOfIsoWeek(year, week);
	const check = isoWeekOf(monday);
	if (check.year !== year || check.week !== week) {
		return undefined;
	}
	return { period: "weekly", anchor: monday };
}

function recognizeQuarterly(
	yearFolder: string,
	match: RegExpExecArray,
): Recognized | undefined {
	if (!YEAR_FOLDER.test(yearFolder)) {
		return undefined;
	}
	const filenameQuarterStr = match[1];
	if (filenameQuarterStr === undefined) {
		return undefined;
	}
	const year = Number(yearFolder);
	const quarter = Number(filenameQuarterStr);
	// Mid-month of the middle month of the quarter: Feb 15 / May 15 / Aug 15 /
	// Nov 15. Same convention as parseRef for quarterly refs; round-trips
	// cleanly through the resolver and through stepAnchor.
	return {
		period: "quarterly",
		anchor: atLocalNoon(year, (quarter - 1) * 3 + 1, 15),
	};
}

function recognizeYearly(match: RegExpExecArray): Recognized | undefined {
	const filenameYearStr = match[1];
	if (filenameYearStr === undefined) {
		return undefined;
	}
	const year = Number(filenameYearStr);
	// July 1: same convention as parseRef for yearly refs. Mid-year sidesteps
	// the year-boundary ambiguity around ISO week-year vs calendar year.
	return { period: "yearly", anchor: atLocalNoon(year, 6, 1) };
}

function atLocalNoon(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}
