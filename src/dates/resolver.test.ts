import { describe, expect, it } from "vitest";
import {
	type Period,
	type Resolved,
	isoWeekOf,
	quarterOfWeek,
	resolve,
} from "./resolver";

// All tests construct dates in local time via `new Date(y, mIndex, d)` so they
// agree with the resolver's local-time math regardless of the runner's TZ.
function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day);
}

describe("resolve - worked examples from docs/design/folder-layout.md", () => {
	it("mid-quarter daily note: 2026-05-11", () => {
		expect(resolve(localDate(2026, 4, 11), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q2/W20",
			filename: "2026-05-11.md",
			path: "Journal/2026/Q2/W20/2026-05-11.md",
		});
	});

	it("week-spanning-quarter boundary, late side: 2026-03-30 is in Q2/W14", () => {
		expect(resolve(localDate(2026, 2, 30), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q2/W14",
			filename: "2026-03-30.md",
			path: "Journal/2026/Q2/W14/2026-03-30.md",
		});
	});

	it("week-spanning-quarter boundary, early side: 2026-03-29 is in Q1/W13", () => {
		expect(resolve(localDate(2026, 2, 29), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q1/W13",
			filename: "2026-03-29.md",
			path: "Journal/2026/Q1/W13/2026-03-29.md",
		});
	});

	it("year boundary: 2026-12-30 is in 2026/Q4/W53", () => {
		expect(resolve(localDate(2026, 11, 30), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q4/W53",
			filename: "2026-12-30.md",
			path: "Journal/2026/Q4/W53/2026-12-30.md",
		});
	});

	it("year boundary: 2027-01-01 files under 2026/Q4/W53 (ISO week-year)", () => {
		expect(resolve(localDate(2027, 0, 1), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q4/W53",
			filename: "2027-01-01.md",
			path: "Journal/2026/Q4/W53/2027-01-01.md",
		});
	});

	it("first week of a new ISO year: 2027-01-04 in 2027/Q1/W01", () => {
		expect(resolve(localDate(2027, 0, 4), "daily")).toEqual<Resolved>({
			folder: "Journal/2027/Q1/W01",
			filename: "2027-01-04.md",
			path: "Journal/2027/Q1/W01/2027-01-04.md",
		});
	});

	it("quarterly note for Q2 2026", () => {
		expect(resolve(localDate(2026, 3, 15), "quarterly")).toEqual<Resolved>({
			folder: "Journal/2026/Q2",
			filename: "Q2.md",
			path: "Journal/2026/Q2/Q2.md",
		});
	});

	it("yearly note for 2026", () => {
		expect(resolve(localDate(2026, 6, 4), "yearly")).toEqual<Resolved>({
			folder: "Journal/2026",
			filename: "2026.md",
			path: "Journal/2026/2026.md",
		});
	});
});

describe("resolve - quarter boundaries", () => {
	// Q1/Q2 boundary: see worked examples above for 2026-03-29 (Q1) vs 2026-03-30 (Q2).

	it("Q2/Q3 boundary, early side: 2026-06-28 (Sun) sits in Q2/W26", () => {
		expect(resolve(localDate(2026, 5, 28), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q2/W26",
			filename: "2026-06-28.md",
			path: "Journal/2026/Q2/W26/2026-06-28.md",
		});
	});

	it("Q2/Q3 boundary, late side: 2026-06-29 (Mon) sits in Q3/W27", () => {
		expect(resolve(localDate(2026, 5, 29), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q3/W27",
			filename: "2026-06-29.md",
			path: "Journal/2026/Q3/W27/2026-06-29.md",
		});
	});

	it("Q3/Q4 boundary: 2026-09-28 (Mon) sits in Q4/W40", () => {
		// Thursday of this week is 2026-10-01.
		expect(resolve(localDate(2026, 8, 28), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q4/W40",
			filename: "2026-09-28.md",
			path: "Journal/2026/Q4/W40/2026-09-28.md",
		});
	});

	it("Q3/Q4 boundary: 2026-09-27 (Sun) sits in Q3/W39", () => {
		// Thursday of this week is 2026-09-24.
		expect(resolve(localDate(2026, 8, 27), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q3/W39",
			filename: "2026-09-27.md",
			path: "Journal/2026/Q3/W39/2026-09-27.md",
		});
	});
});

describe("resolve - year boundaries", () => {
	it("2025-12-29 (Mon) files under Journal/2026/Q1/W01 (December date, next ISO year)", () => {
		expect(resolve(localDate(2025, 11, 29), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q1/W01",
			filename: "2025-12-29.md",
			path: "Journal/2026/Q1/W01/2025-12-29.md",
		});
	});

	it("2027-01-02 (Sat) files under Journal/2026/Q4/W53", () => {
		expect(resolve(localDate(2027, 0, 2), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q4/W53",
			filename: "2027-01-02.md",
			path: "Journal/2026/Q4/W53/2027-01-02.md",
		});
	});

	it("2027-01-03 (Sun) is the last day of 2026's ISO week 53", () => {
		expect(resolve(localDate(2027, 0, 3), "daily")).toEqual<Resolved>({
			folder: "Journal/2026/Q4/W53",
			filename: "2027-01-03.md",
			path: "Journal/2026/Q4/W53/2027-01-03.md",
		});
	});

	it("2020 had 53 ISO weeks: 2020-12-28 sits in 2020/Q4/W53", () => {
		// Thursday of this week is 2020-12-31.
		expect(resolve(localDate(2020, 11, 28), "daily")).toEqual<Resolved>({
			folder: "Journal/2020/Q4/W53",
			filename: "2020-12-28.md",
			path: "Journal/2020/Q4/W53/2020-12-28.md",
		});
	});

	it("2024-12-30 (Mon) files under Journal/2025/Q1/W01", () => {
		// Thursday is 2025-01-02; ISO week-year 2025.
		expect(resolve(localDate(2024, 11, 30), "daily")).toEqual<Resolved>({
			folder: "Journal/2025/Q1/W01",
			filename: "2024-12-30.md",
			path: "Journal/2025/Q1/W01/2024-12-30.md",
		});
	});
});

describe("resolve - weekly notes", () => {
	it("weekly note for ISO 2026-W20", () => {
		expect(resolve(localDate(2026, 4, 11), "weekly")).toEqual<Resolved>({
			folder: "Journal/2026/Q2/W20",
			filename: "W20.md",
			path: "Journal/2026/Q2/W20/W20.md",
		});
	});

	it("weekly note for ISO 2026-W53 from a 2027 calendar date", () => {
		expect(resolve(localDate(2027, 0, 1), "weekly")).toEqual<Resolved>({
			folder: "Journal/2026/Q4/W53",
			filename: "W53.md",
			path: "Journal/2026/Q4/W53/W53.md",
		});
	});

	it("weekly note zero-pads single-digit week numbers", () => {
		expect(resolve(localDate(2027, 0, 4), "weekly")).toEqual<Resolved>({
			folder: "Journal/2027/Q1/W01",
			filename: "W01.md",
			path: "Journal/2027/Q1/W01/W01.md",
		});
	});
});

describe("resolve - quarterly notes", () => {
	it.each<{ label: string; date: Date; quarter: number }>([
		{ label: "Q1", date: localDate(2026, 0, 15), quarter: 1 },
		{ label: "Q2", date: localDate(2026, 3, 15), quarter: 2 },
		{ label: "Q3", date: localDate(2026, 6, 15), quarter: 3 },
		{ label: "Q4", date: localDate(2026, 9, 15), quarter: 4 },
	])("$label", ({ date, quarter }) => {
		expect(resolve(date, "quarterly")).toEqual<Resolved>({
			folder: `Journal/2026/Q${quarter}`,
			filename: `Q${quarter}.md`,
			path: `Journal/2026/Q${quarter}/Q${quarter}.md`,
		});
	});
});

describe("resolve - yearly notes", () => {
	it("2026 yearly", () => {
		expect(resolve(localDate(2026, 6, 4), "yearly")).toEqual<Resolved>({
			folder: "Journal/2026",
			filename: "2026.md",
			path: "Journal/2026/2026.md",
		});
	});

	it("2027 yearly", () => {
		expect(resolve(localDate(2027, 6, 4), "yearly")).toEqual<Resolved>({
			folder: "Journal/2027",
			filename: "2027.md",
			path: "Journal/2027/2027.md",
		});
	});

	it("yearly anchor reports the ISO week-year, not the calendar year", () => {
		// 2027-01-01 belongs to ISO week-year 2026.
		expect(resolve(localDate(2027, 0, 1), "yearly")).toEqual<Resolved>({
			folder: "Journal/2026",
			filename: "2026.md",
			path: "Journal/2026/2026.md",
		});
	});
});

describe("resolve - root override", () => {
	it("uses the default Journal root when no root is supplied", () => {
		expect(resolve(localDate(2026, 4, 11), "daily").folder).toBe(
			"Journal/2026/Q2/W20",
		);
	});

	it("respects a custom root", () => {
		expect(resolve(localDate(2026, 4, 11), "daily", "Diary")).toEqual<Resolved>({
			folder: "Diary/2026/Q2/W20",
			filename: "2026-05-11.md",
			path: "Diary/2026/Q2/W20/2026-05-11.md",
		});
	});
});

describe("resolve - input immutability", () => {
	it("does not mutate the anchor Date", () => {
		const anchor = localDate(2026, 4, 11);
		const snapshot = anchor.getTime();
		resolve(anchor, "daily");
		resolve(anchor, "weekly");
		resolve(anchor, "quarterly");
		resolve(anchor, "yearly");
		expect(anchor.getTime()).toBe(snapshot);
	});
});

describe("resolve - exhaustiveness", () => {
	it("throws for an unknown period passed at runtime", () => {
		// Caller bypasses the TypeScript exhaustiveness check.
		expect(() =>
			resolve(localDate(2026, 4, 11), "monthly" as unknown as Period),
		).toThrow(/Unknown period/);
	});
});

describe("isoWeekOf", () => {
	it.each<{ date: Date; year: number; week: number }>([
		{ date: localDate(2026, 4, 11), year: 2026, week: 20 },
		{ date: localDate(2026, 2, 29), year: 2026, week: 13 },
		{ date: localDate(2026, 2, 30), year: 2026, week: 14 },
		{ date: localDate(2026, 11, 30), year: 2026, week: 53 },
		{ date: localDate(2027, 0, 1), year: 2026, week: 53 },
		{ date: localDate(2027, 0, 4), year: 2027, week: 1 },
		{ date: localDate(2025, 11, 29), year: 2026, week: 1 },
		{ date: localDate(2020, 11, 28), year: 2020, week: 53 },
	])("$date.toISOString() -> $year-W$week", ({ date, year, week }) => {
		expect(isoWeekOf(date)).toEqual({ year, week });
	});
});

describe("quarterOfWeek", () => {
	it.each<{ date: Date; year: number; quarter: number }>([
		{ date: localDate(2026, 4, 11), year: 2026, quarter: 2 },
		{ date: localDate(2026, 2, 29), year: 2026, quarter: 1 },
		{ date: localDate(2026, 2, 30), year: 2026, quarter: 2 },
		{ date: localDate(2026, 5, 28), year: 2026, quarter: 2 },
		{ date: localDate(2026, 5, 29), year: 2026, quarter: 3 },
		{ date: localDate(2027, 0, 1), year: 2026, quarter: 4 },
	])("$date.toISOString() -> $year Q$quarter", ({ date, year, quarter }) => {
		expect(quarterOfWeek(date)).toEqual({ year, quarter });
	});
});
