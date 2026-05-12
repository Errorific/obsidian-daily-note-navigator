import { describe, expect, it } from "vitest";
import { parseRef } from "./refs";
import { resolve } from "./resolver";

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

describe("parseRef - daily", () => {
	it("parses YYYY-MM-DD", () => {
		expect(parseRef("2026-05-11", "daily")).toEqual(localDate(2026, 4, 11));
	});

	it("parses Jan 1 of a Thursday-start year", () => {
		expect(parseRef("2026-01-01", "daily")).toEqual(localDate(2026, 0, 1));
	});

	it("parses leap-day 2024-02-29", () => {
		expect(parseRef("2024-02-29", "daily")).toEqual(localDate(2024, 1, 29));
	});

	it("rejects a missing day", () => {
		expect(() => parseRef("2026-05", "daily")).toThrow(
			"ref '2026-05' is not valid for period 'daily'",
		);
	});

	it("rejects a non-existent calendar date", () => {
		expect(() => parseRef("2026-02-30", "daily")).toThrow(
			"ref '2026-02-30' is not valid for period 'daily'",
		);
	});

	it("rejects month 13", () => {
		expect(() => parseRef("2026-13-01", "daily")).toThrow(
			"ref '2026-13-01' is not valid for period 'daily'",
		);
	});

	it("rejects Feb 29 in a non-leap year", () => {
		expect(() => parseRef("2025-02-29", "daily")).toThrow(
			"ref '2025-02-29' is not valid for period 'daily'",
		);
	});

	it("rejects a non-numeric year", () => {
		expect(() => parseRef("abcd-05-11", "daily")).toThrow(
			"ref 'abcd-05-11' is not valid for period 'daily'",
		);
	});

	it("rejects unzero-padded components", () => {
		expect(() => parseRef("2026-5-11", "daily")).toThrow(
			"ref '2026-5-11' is not valid for period 'daily'",
		);
	});

	it("rejects a weekly ref passed with period=daily", () => {
		expect(() => parseRef("2026/W20", "daily")).toThrow(
			"ref '2026/W20' is not valid for period 'daily'",
		);
	});
});

describe("parseRef - weekly", () => {
	it("parses YYYY/W{ww}", () => {
		// Monday of ISO 2026-W20 is 2026-05-11.
		expect(parseRef("2026/W20", "weekly")).toEqual(localDate(2026, 4, 11));
	});

	it("parses YYYY-W{ww}", () => {
		expect(parseRef("2026-W20", "weekly")).toEqual(localDate(2026, 4, 11));
	});

	it("parses without a leading zero", () => {
		expect(parseRef("2027/W1", "weekly")).toEqual(localDate(2027, 0, 4));
	});

	it("parses W01 with leading zero", () => {
		expect(parseRef("2027/W01", "weekly")).toEqual(localDate(2027, 0, 4));
	});

	it("parses W53 in a year that has 53 weeks", () => {
		// Monday of ISO 2026-W53 is 2026-12-28.
		expect(parseRef("2026/W53", "weekly")).toEqual(localDate(2026, 11, 28));
	});

	it("parsed weekly anchor resolves back to the requested week", () => {
		const anchor = parseRef("2026/W20", "weekly");
		expect(resolve(anchor, "weekly").path).toBe(
			"Journal/2026/Q2/W20/W20.md",
		);
	});

	it("parsed W53-2026 anchor resolves back to W53", () => {
		const anchor = parseRef("2026/W53", "weekly");
		expect(resolve(anchor, "weekly").path).toBe(
			"Journal/2026/Q4/W53/W53.md",
		);
	});

	it("rejects W00", () => {
		expect(() => parseRef("2026/W00", "weekly")).toThrow(
			"ref '2026/W00' is not valid for period 'weekly'",
		);
	});

	it("rejects W54", () => {
		expect(() => parseRef("2026/W54", "weekly")).toThrow(
			"ref '2026/W54' is not valid for period 'weekly'",
		);
	});

	it("rejects W53 in a year that only has 52 ISO weeks", () => {
		expect(() => parseRef("2025/W53", "weekly")).toThrow(
			"ref '2025/W53' is not valid for period 'weekly'",
		);
	});

	it("rejects a daily ref passed with period=weekly", () => {
		expect(() => parseRef("2026-05-11", "weekly")).toThrow(
			"ref '2026-05-11' is not valid for period 'weekly'",
		);
	});

	it("rejects a quarterly ref passed with period=weekly", () => {
		expect(() => parseRef("2026/Q2", "weekly")).toThrow(
			"ref '2026/Q2' is not valid for period 'weekly'",
		);
	});

	it("rejects a yearly ref passed with period=weekly", () => {
		expect(() => parseRef("2026", "weekly")).toThrow(
			"ref '2026' is not valid for period 'weekly'",
		);
	});

	it("rejects junk", () => {
		expect(() => parseRef("hello", "weekly")).toThrow(
			"ref 'hello' is not valid for period 'weekly'",
		);
	});
});

describe("parseRef - quarterly", () => {
	it("parses YYYY/Q{q}", () => {
		// Mid-quarter anchor: 2026-05-15.
		expect(parseRef("2026/Q2", "quarterly")).toEqual(localDate(2026, 4, 15));
	});

	it("parses YYYY-Q{q}", () => {
		expect(parseRef("2026-Q2", "quarterly")).toEqual(localDate(2026, 4, 15));
	});

	it.each<{ ref: string; year: number; month: number; quarter: number }>([
		{ ref: "2026/Q1", year: 2026, month: 1, quarter: 1 },
		{ ref: "2026/Q2", year: 2026, month: 4, quarter: 2 },
		{ ref: "2026/Q3", year: 2026, month: 7, quarter: 3 },
		{ ref: "2026/Q4", year: 2026, month: 10, quarter: 4 },
	])("$ref resolves to Journal/$year/Q$quarter/Q$quarter.md", ({ ref, year, quarter }) => {
		const anchor = parseRef(ref, "quarterly");
		expect(resolve(anchor, "quarterly").path).toBe(
			`Journal/${year}/Q${quarter}/Q${quarter}.md`,
		);
	});

	it("Q1 anchor lies in the requested ISO week-year even when Jan 1 belongs to the previous one", () => {
		// 2027-01-01 falls into ISO week-year 2026. A naive "first day of Q1"
		// anchor would mis-route 2027/Q1 to Journal/2026/Q4. The mid-quarter
		// anchor (Feb 15) sidesteps the problem.
		expect(resolve(parseRef("2027/Q1", "quarterly"), "quarterly").path).toBe(
			"Journal/2027/Q1/Q1.md",
		);
	});

	it("rejects Q0", () => {
		expect(() => parseRef("2026/Q0", "quarterly")).toThrow(
			"ref '2026/Q0' is not valid for period 'quarterly'",
		);
	});

	it("rejects Q5", () => {
		expect(() => parseRef("2026/Q5", "quarterly")).toThrow(
			"ref '2026/Q5' is not valid for period 'quarterly'",
		);
	});

	it("rejects a daily ref passed with period=quarterly", () => {
		expect(() => parseRef("2026-05-11", "quarterly")).toThrow(
			"ref '2026-05-11' is not valid for period 'quarterly'",
		);
	});

	it("rejects a weekly ref passed with period=quarterly", () => {
		expect(() => parseRef("2026/W20", "quarterly")).toThrow(
			"ref '2026/W20' is not valid for period 'quarterly'",
		);
	});

	it("rejects a yearly ref passed with period=quarterly", () => {
		expect(() => parseRef("2026", "quarterly")).toThrow(
			"ref '2026' is not valid for period 'quarterly'",
		);
	});
});

describe("parseRef - yearly", () => {
	it("parses YYYY", () => {
		expect(parseRef("2026", "yearly")).toEqual(localDate(2026, 6, 1));
	});

	it("resolved path matches Journal/{year}/{year}.md", () => {
		expect(resolve(parseRef("2026", "yearly"), "yearly").path).toBe(
			"Journal/2026/2026.md",
		);
	});

	it("resolves the next year correctly", () => {
		expect(resolve(parseRef("2027", "yearly"), "yearly").path).toBe(
			"Journal/2027/2027.md",
		);
	});

	it("rejects three-digit years", () => {
		expect(() => parseRef("999", "yearly")).toThrow(
			"ref '999' is not valid for period 'yearly'",
		);
	});

	it("rejects five-digit years", () => {
		expect(() => parseRef("20260", "yearly")).toThrow(
			"ref '20260' is not valid for period 'yearly'",
		);
	});

	it("rejects a non-numeric year", () => {
		expect(() => parseRef("twok", "yearly")).toThrow(
			"ref 'twok' is not valid for period 'yearly'",
		);
	});

	it("rejects a daily ref passed with period=yearly", () => {
		expect(() => parseRef("2026-05-11", "yearly")).toThrow(
			"ref '2026-05-11' is not valid for period 'yearly'",
		);
	});

	it("rejects a weekly ref passed with period=yearly", () => {
		expect(() => parseRef("2026/W20", "yearly")).toThrow(
			"ref '2026/W20' is not valid for period 'yearly'",
		);
	});

	it("rejects a quarterly ref passed with period=yearly", () => {
		expect(() => parseRef("2026/Q2", "yearly")).toThrow(
			"ref '2026/Q2' is not valid for period 'yearly'",
		);
	});
});

describe("parseRef - end-to-end through resolve", () => {
	it.each<{ ref: string; period: Parameters<typeof parseRef>[1]; path: string }>([
		{ ref: "2026-05-11", period: "daily", path: "Journal/2026/Q2/W20/2026-05-11.md" },
		{ ref: "2027-01-01", period: "daily", path: "Journal/2026/Q4/W53/2027-01-01.md" },
		{ ref: "2026/W20", period: "weekly", path: "Journal/2026/Q2/W20/W20.md" },
		{ ref: "2026/Q2", period: "quarterly", path: "Journal/2026/Q2/Q2.md" },
		{ ref: "2026", period: "yearly", path: "Journal/2026/2026.md" },
	])("$ref ($period) -> $path", ({ ref, period, path }) => {
		expect(resolve(parseRef(ref, period), period).path).toBe(path);
	});
});
