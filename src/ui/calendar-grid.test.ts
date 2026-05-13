import { describe, expect, it } from "vitest";
import {
	buildMonthGrid,
	calendarQuarterOf,
	stepMonth,
} from "./calendar-grid";

function noon(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

describe("buildMonthGrid", () => {
	it("always renders exactly 6 rows", () => {
		// Spot-check across months with different boundary shapes.
		expect(buildMonthGrid(2026, 4, noon(2026, 4, 13))).toHaveLength(6);
		expect(buildMonthGrid(2026, 6, noon(2026, 4, 13))).toHaveLength(6);
		expect(buildMonthGrid(2010, 1, noon(2010, 1, 1))).toHaveLength(6);
		expect(buildMonthGrid(2027, 0, noon(2026, 4, 13))).toHaveLength(6);
		expect(buildMonthGrid(2021, 4, noon(2026, 4, 13))).toHaveLength(6);
	});

	it("renders May 2026 starting at W18 and extending into W23 (Jun 1-7)", () => {
		const rows = buildMonthGrid(2026, 4, noon(2026, 4, 13));
		expect(rows.map((r) => r.isoWeek)).toEqual([18, 19, 20, 21, 22, 23]);
		// First row Monday = Apr 27 (prev-month overlap).
		expect(rows[0]?.days[0]?.date.getDate()).toBe(27);
		expect(rows[0]?.days[0]?.inDisplayedMonth).toBe(false);
		// Last row Monday = Jun 1 (next-month overlap).
		expect(rows[5]?.days[0]?.date.getMonth()).toBe(5);
		expect(rows[5]?.days[0]?.date.getDate()).toBe(1);
		expect(rows[5]?.days[6]?.date.getDate()).toBe(7);
	});

	it("shifts back when the 1st is a Monday so the top row is prev-month", () => {
		// June 2026: Jun 1 is Monday. Without the shift, row 0 would be Jun 1-7
		// and have no previous-month overlap. The shift produces W22 (May 25-31).
		const rows = buildMonthGrid(2026, 5, noon(2026, 4, 13));
		expect(rows[0]?.isoWeek).toBe(22);
		expect(rows[0]?.days[0]?.date.getMonth()).toBe(4); // May
		expect(rows[0]?.days[0]?.date.getDate()).toBe(25);
		expect(rows[0]?.days[6]?.date.getDate()).toBe(31);
		// Row 1 is the first row of June.
		expect(rows[1]?.days[0]?.date.getMonth()).toBe(5);
		expect(rows[1]?.days[0]?.date.getDate()).toBe(1);
	});

	it("marks today's cell when today falls in the displayed month", () => {
		const rows = buildMonthGrid(2026, 4, noon(2026, 4, 13));
		const todayCells = rows
			.flatMap((r) => r.days)
			.filter((d) => d.isToday);
		expect(todayCells).toHaveLength(1);
		expect(todayCells[0]?.date.getDate()).toBe(13);
		expect(todayCells[0]?.date.getMonth()).toBe(4);
	});

	it("can mark today on an adjacent-month cell of the displayed view", () => {
		// Showing April 2026 with today = May 1 (Fri). May 1 is the 5th cell of
		// the last natural-overlap row, plus the 6th-row padding shows further
		// May days; both are marked when matching.
		const rows = buildMonthGrid(2026, 3, noon(2026, 4, 1));
		const todays = rows.flatMap((r) => r.days).filter((d) => d.isToday);
		expect(todays).toHaveLength(1);
		expect(todays[0]?.inDisplayedMonth).toBe(false);
	});

	it("does not mark today when today is in a different month and not visible", () => {
		const rows = buildMonthGrid(2026, 0, noon(2026, 4, 13));
		const todayCells = rows.flatMap((r) => r.days).filter((d) => d.isToday);
		expect(todayCells).toHaveLength(0);
	});

	it("displays W53 2026 as the leading row when showing January 2027", () => {
		const rows = buildMonthGrid(2027, 0, noon(2026, 4, 13));
		expect(rows[0]?.isoYear).toBe(2026);
		expect(rows[0]?.isoWeek).toBe(53);
		const leadingFri = rows[0]?.days[4];
		expect(leadingFri?.date.getFullYear()).toBe(2027);
		expect(leadingFri?.date.getMonth()).toBe(0);
		expect(leadingFri?.date.getDate()).toBe(1);
		expect(leadingFri?.inDisplayedMonth).toBe(true);
	});

	it("includes W53 2026 inside the December 2026 grid", () => {
		const rows = buildMonthGrid(2026, 11, noon(2026, 4, 13));
		const weeks = rows.map((r) => `${r.isoYear}-W${r.isoWeek}`);
		expect(weeks).toContain("2026-W53");
		expect(weeks).toContain("2027-W1");
	});

	it("renders Feb 2010 as W4..W9 with the 1st-is-Monday shift applied", () => {
		const rows = buildMonthGrid(2010, 1, noon(2010, 1, 1));
		expect(rows.map((r) => r.isoWeek)).toEqual([4, 5, 6, 7, 8, 9]);
		// W4 is fully prev-month (Jan 25-31).
		const w4Days = rows[0]?.days ?? [];
		expect(w4Days.every((d) => !d.inDisplayedMonth)).toBe(true);
		// W9 is fully next-month (Mar 1-7).
		const w9Days = rows[5]?.days ?? [];
		expect(w9Days.every((d) => !d.inDisplayedMonth)).toBe(true);
	});

	it("does not mutate the today argument", () => {
		const today = noon(2026, 4, 13);
		const snapshot = today.getTime();
		buildMonthGrid(2026, 4, today);
		expect(today.getTime()).toBe(snapshot);
	});
});

describe("calendarQuarterOf", () => {
	it("maps month indexes to calendar quarters 1..4", () => {
		expect(calendarQuarterOf(0)).toBe(1);
		expect(calendarQuarterOf(2)).toBe(1);
		expect(calendarQuarterOf(3)).toBe(2);
		expect(calendarQuarterOf(5)).toBe(2);
		expect(calendarQuarterOf(6)).toBe(3);
		expect(calendarQuarterOf(8)).toBe(3);
		expect(calendarQuarterOf(9)).toBe(4);
		expect(calendarQuarterOf(11)).toBe(4);
	});
});

describe("stepMonth", () => {
	it("advances within a year", () => {
		expect(stepMonth(2026, 4, 1)).toEqual({ year: 2026, monthIndex: 5 });
		expect(stepMonth(2026, 4, -1)).toEqual({ year: 2026, monthIndex: 3 });
	});

	it("rolls forward across a year boundary", () => {
		expect(stepMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
	});

	it("rolls backward across a year boundary", () => {
		expect(stepMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 });
	});

	it("handles multi-month steps", () => {
		expect(stepMonth(2026, 0, 14)).toEqual({ year: 2027, monthIndex: 2 });
		expect(stepMonth(2026, 0, -13)).toEqual({ year: 2024, monthIndex: 11 });
	});
});
