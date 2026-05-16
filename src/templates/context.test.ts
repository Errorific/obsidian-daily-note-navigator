import { describe, expect, it } from "vitest";
import { parseRef } from "../dates/refs";
import { resolve } from "../dates/resolver";
import { type Context, buildContext } from "./context";

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

describe("buildContext - daily", () => {
	it("populates every marker for a mid-quarter daily note", () => {
		const anchor = localDate(2026, 4, 11);
		const resolved = resolve(anchor, "daily");
		expect(buildContext(anchor, "daily", resolved)).toEqual<Context>({
			period: "daily",
			year: "2026",
			quarter: "2",
			week: "20",
			anchor_date: "2026-05-11",
			folder: "Journal/2026/Q2/W20",
			filename: "2026-05-11 Monday",
			path: "Journal/2026/Q2/W20/2026-05-11 Monday.md",
		});
	});

	it("uses the daily date directly as the anchor_date", () => {
		const anchor = localDate(2026, 0, 1);
		expect(buildContext(anchor, "daily", resolve(anchor, "daily")).anchor_date).toBe(
			"2026-01-01",
		);
	});
});

describe("buildContext - weekly", () => {
	it("anchor_date is the Monday of the ISO week, even when anchor is mid-week", () => {
		// 2026-05-14 is Thursday of ISO W20. Monday of W20 is 2026-05-11.
		const anchor = localDate(2026, 4, 14);
		const ctx = buildContext(anchor, "weekly", resolve(anchor, "weekly"));
		expect(ctx.anchor_date).toBe("2026-05-11");
		expect(ctx.week).toBe("20");
		expect(ctx.filename).toBe("W20");
		expect(ctx.path).toBe("Journal/2026/Q2/W20.md");
	});

	it("zero-pads single-digit week numbers", () => {
		const anchor = localDate(2027, 0, 4);
		expect(buildContext(anchor, "weekly", resolve(anchor, "weekly")).week).toBe(
			"01",
		);
	});
});

describe("buildContext - quarterly", () => {
	it("anchor_date is the first Thursday of the calendar quarter", () => {
		// 2026-04-01 is a Wednesday, so the first Thursday of Q2 2026 is Apr 2.
		const anchor = localDate(2026, 3, 15);
		const ctx = buildContext(anchor, "quarterly", resolve(anchor, "quarterly"));
		expect(ctx.anchor_date).toBe("2026-04-02");
		expect(ctx.filename).toBe("Q2");
		expect(ctx.folder).toBe("Journal/2026");
		expect(ctx.path).toBe("Journal/2026/Q2.md");
	});

	it.each<{ ref: Date; quarter: string; anchorDate: string }>([
		// 2026-01-01 is Thursday -> first Thursday of Q1.
		{ ref: localDate(2026, 0, 15), quarter: "1", anchorDate: "2026-01-01" },
		// 2026-04-01 is Wed -> first Thursday is Apr 2.
		{ ref: localDate(2026, 4, 15), quarter: "2", anchorDate: "2026-04-02" },
		// 2026-07-01 is Wed -> first Thursday is Jul 2.
		{ ref: localDate(2026, 7, 15), quarter: "3", anchorDate: "2026-07-02" },
		// 2026-10-01 is Thursday -> first Thursday of Q4.
		{ ref: localDate(2026, 10, 15), quarter: "4", anchorDate: "2026-10-01" },
	])("Q$quarter -> anchor_date $anchorDate", ({ ref, quarter, anchorDate }) => {
		const ctx = buildContext(ref, "quarterly", resolve(ref, "quarterly"));
		expect(ctx.quarter).toBe(quarter);
		expect(ctx.anchor_date).toBe(anchorDate);
	});

	it("Q1 anchor is unambiguous when Jan 1 sits in the previous ISO week-year", () => {
		// 2027-01-01 is Friday and belongs to ISO 2026-W53. A naive
		// first-of-quarter anchor (2027-01-01) would round-trip to
		// Journal/2026/Q4. First Thursday of Q1 2027 is Jan 7, which
		// round-trips correctly.
		const anchor = localDate(2027, 1, 15);
		const ctx = buildContext(anchor, "quarterly", resolve(anchor, "quarterly"));
		expect(ctx.anchor_date).toBe("2027-01-07");
		expect(ctx.path).toBe("Journal/2027/Q1.md");
	});

	it("Q1 anchor is also correct when Jan 1 is a Saturday (2033)", () => {
		// 2033-01-01 is Saturday -> first Thursday of Jan 2033 is Jan 6.
		const anchor = localDate(2033, 1, 15);
		const ctx = buildContext(anchor, "quarterly", resolve(anchor, "quarterly"));
		expect(ctx.anchor_date).toBe("2033-01-06");
	});

	it("anchor_date round-trips through the quarterly resolver for every boundary case", () => {
		// Round-trip: emitted anchor_date, fed back as a CLI date= input,
		// must resolve to the same quarterly note.
		const cases = [
			localDate(2026, 1, 15), // Q1 2026
			localDate(2027, 1, 15), // Q1 2027 (Fri-start year)
			localDate(2032, 1, 15), // Q1 2032 (Thu-start year)
			localDate(2033, 1, 15), // Q1 2033 (Sat-start year)
			localDate(2034, 1, 15), // Q1 2034 (Sun-start year)
		];
		for (const anchor of cases) {
			const originalResolved = resolve(anchor, "quarterly");
			const ctx = buildContext(anchor, "quarterly", originalResolved);
			const replayed = parseRef(ctx.anchor_date, "daily");
			expect(resolve(replayed, "quarterly").path).toBe(originalResolved.path);
		}
	});
});

describe("buildContext - yearly", () => {
	it("anchor_date is July 1 of the ISO week-year", () => {
		const anchor = localDate(2026, 6, 4);
		const ctx = buildContext(anchor, "yearly", resolve(anchor, "yearly"));
		expect(ctx.anchor_date).toBe("2026-07-01");
		expect(ctx.year).toBe("2026");
		expect(ctx.filename).toBe("2026");
		expect(ctx.folder).toBe("Journal");
		expect(ctx.path).toBe("Journal/2026.md");
	});
});

describe("buildContext - boundaries", () => {
	it("quarter boundary: 2026-03-30 (W14) reports quarter=2 per the Thursday rule", () => {
		const anchor = localDate(2026, 2, 30);
		const ctx = buildContext(anchor, "daily", resolve(anchor, "daily"));
		expect(ctx.quarter).toBe("2");
		expect(ctx.week).toBe("14");
		expect(ctx.year).toBe("2026");
		expect(ctx.folder).toBe("Journal/2026/Q2/W14");
	});

	it("quarter boundary: 2026-03-29 (W13) reports quarter=1", () => {
		const anchor = localDate(2026, 2, 29);
		const ctx = buildContext(anchor, "daily", resolve(anchor, "daily"));
		expect(ctx.quarter).toBe("1");
		expect(ctx.week).toBe("13");
	});

	it("year boundary: 2027-01-01 reports year=2026, quarter=4, week=53", () => {
		const anchor = localDate(2027, 0, 1);
		const ctx = buildContext(anchor, "daily", resolve(anchor, "daily"));
		expect(ctx.year).toBe("2026");
		expect(ctx.quarter).toBe("4");
		expect(ctx.week).toBe("53");
		expect(ctx.anchor_date).toBe("2027-01-01");
		expect(ctx.filename).toBe("2027-01-01 Friday");
		expect(ctx.folder).toBe("Journal/2026/Q4/W53");
	});

	it("year boundary: weekly anchor_date for 2027-01-01 is the W53 Monday (2026-12-28)", () => {
		const anchor = localDate(2027, 0, 1);
		const ctx = buildContext(anchor, "weekly", resolve(anchor, "weekly"));
		expect(ctx.anchor_date).toBe("2026-12-28");
		expect(ctx.week).toBe("53");
		expect(ctx.folder).toBe("Journal/2026/Q4");
	});

	it("year boundary: yearly anchor_date for 2027-01-01 is 2026-07-01 (ISO week-year)", () => {
		const anchor = localDate(2027, 0, 1);
		const ctx = buildContext(anchor, "yearly", resolve(anchor, "yearly"));
		expect(ctx.anchor_date).toBe("2026-07-01");
		expect(ctx.year).toBe("2026");
	});

	it("year boundary: 2024-12-30 (W01 of 2025) reports year=2025, quarter=1", () => {
		const anchor = localDate(2024, 11, 30);
		const ctx = buildContext(anchor, "daily", resolve(anchor, "daily"));
		expect(ctx.year).toBe("2025");
		expect(ctx.quarter).toBe("1");
		expect(ctx.week).toBe("01");
	});
});

describe("buildContext - period passthrough", () => {
	it.each(["daily", "weekly", "quarterly", "yearly"] as const)(
		"period field reflects the input: %s",
		(period) => {
			const anchor = localDate(2026, 4, 11);
			expect(buildContext(anchor, period, resolve(anchor, period)).period).toBe(
				period,
			);
		},
	);
});
