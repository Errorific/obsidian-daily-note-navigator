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
	it("renders May 2026 as five Mon-Sun rows W18..W22", () => {
		const rows = buildMonthGrid(2026, 4, noon(2026, 4, 13));
		expect(rows).toHaveLength(5);
		expect(rows.map((r) => r.isoWeek)).toEqual([18, 19, 20, 21, 22]);
		expect(rows[0]?.days[0]?.date.getDate()).toBe(27); // Mon Apr 27
		expect(rows[0]?.days[0]?.inDisplayedMonth).toBe(false);
		expect(rows[0]?.days[4]?.date.getDate()).toBe(1); // Fri May 1
		expect(rows[0]?.days[4]?.inDisplayedMonth).toBe(true);
		expect(rows[4]?.days[6]?.date.getDate()).toBe(31); // Sun May 31
		expect(rows[4]?.days[6]?.inDisplayedMonth).toBe(true);
	});

	it("marks today's cell when today falls in the displayed month", () => {
		const rows = buildMonthGrid(2026, 4, noon(2026, 4, 13));
		const flat = rows.flatMap((r) => r.days);
		const todayCells = flat.filter((d) => d.isToday);
		expect(todayCells).toHaveLength(1);
		expect(todayCells[0]?.date.getDate()).toBe(13);
		expect(todayCells[0]?.date.getMonth()).toBe(4);
	});

	it("does not mark today when today is in a different month", () => {
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

	it("displays W53 2026 as a row inside December 2026", () => {
		const rows = buildMonthGrid(2026, 11, noon(2026, 4, 13));
		const lastRow = rows[rows.length - 1];
		expect(lastRow?.isoYear).toBe(2026);
		expect(lastRow?.isoWeek).toBe(53);
		// Sun Jan 3 2027 sits at the end of W53.
		expect(lastRow?.days[6]?.date.getFullYear()).toBe(2027);
		expect(lastRow?.days[6]?.inDisplayedMonth).toBe(false);
	});

	it("renders Feb 2010 as exactly four rows", () => {
		// Rare case: Feb 1 2010 is a Monday and Feb 28 is a Sunday, so the grid
		// is exactly 4 ISO weeks tall with no overflow into adjacent months.
		const rows = buildMonthGrid(2010, 1, noon(2010, 1, 1));
		expect(rows).toHaveLength(4);
		expect(rows[0]?.isoWeek).toBe(5);
		expect(rows[3]?.isoWeek).toBe(8);
		// All 28 cells fall inside the displayed month.
		const outside = rows
			.flatMap((r) => r.days)
			.filter((d) => !d.inDisplayedMonth);
		expect(outside).toHaveLength(0);
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
