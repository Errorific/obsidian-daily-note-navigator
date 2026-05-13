import { describe, expect, it } from "vitest";
import { recognizePath } from "./recognize";
import { resolve } from "./resolver";
import { stepAnchor } from "./step";

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

describe("stepAnchor", () => {
	it("daily +1 advances by one calendar day", () => {
		expect(stepAnchor(localDate(2026, 4, 11), "daily", 1)).toEqual(
			localDate(2026, 4, 12),
		);
	});

	it("daily -1 retreats by one calendar day", () => {
		expect(stepAnchor(localDate(2026, 4, 11), "daily", -1)).toEqual(
			localDate(2026, 4, 10),
		);
	});

	it("daily crosses month boundary", () => {
		expect(stepAnchor(localDate(2026, 4, 31), "daily", 1)).toEqual(
			localDate(2026, 5, 1),
		);
	});

	it("weekly +1 advances by seven days", () => {
		const next = stepAnchor(localDate(2026, 4, 11), "weekly", 1);
		expect(next).toEqual(localDate(2026, 4, 18));
	});

	it("weekly -1 retreats by seven days", () => {
		expect(stepAnchor(localDate(2026, 4, 11), "weekly", -1)).toEqual(
			localDate(2026, 4, 4),
		);
	});

	it("quarterly +1 advances by three months (keeping day-of-month)", () => {
		expect(stepAnchor(localDate(2026, 4, 15), "quarterly", 1)).toEqual(
			localDate(2026, 7, 15),
		);
	});

	it("quarterly -1 retreats by three months", () => {
		expect(stepAnchor(localDate(2026, 4, 15), "quarterly", -1)).toEqual(
			localDate(2026, 1, 15),
		);
	});

	it("quarterly crosses year boundary", () => {
		expect(stepAnchor(localDate(2026, 1, 15), "quarterly", -1)).toEqual(
			localDate(2025, 10, 15),
		);
	});

	it("yearly +1 advances by one calendar year", () => {
		expect(stepAnchor(localDate(2026, 6, 1), "yearly", 1)).toEqual(
			localDate(2027, 6, 1),
		);
	});

	it("yearly -1 retreats by one calendar year", () => {
		expect(stepAnchor(localDate(2026, 6, 1), "yearly", -1)).toEqual(
			localDate(2025, 6, 1),
		);
	});
});

describe("stepAnchor -- composes with the resolver", () => {
	it("daily step changes the resolved daily filename by one day", () => {
		const start = "Journal/2026/Q2/W20/2026-05-11 Monday.md";
		const r = recognizePath(start);
		expect(r).toBeDefined();
		const next = stepAnchor(r!.anchor, "daily", 1);
		expect(resolve(next, "daily").path).toBe(
			"Journal/2026/Q2/W20/2026-05-12 Tuesday.md",
		);
	});

	it("weekly step moves to the adjacent ISO week", () => {
		const r = recognizePath("Journal/2026/Q2/W20/W20.md");
		const next = stepAnchor(r!.anchor, "weekly", 1);
		expect(resolve(next, "weekly").path).toBe(
			"Journal/2026/Q2/W21/W21.md",
		);
	});

	it("quarterly step moves to the adjacent quarter", () => {
		const r = recognizePath("Journal/2026/Q2/Q2.md");
		const next = stepAnchor(r!.anchor, "quarterly", 1);
		expect(resolve(next, "quarterly").path).toBe("Journal/2026/Q3/Q3.md");
	});

	it("yearly step moves to the adjacent year", () => {
		const r = recognizePath("Journal/2026/2026.md");
		const next = stepAnchor(r!.anchor, "yearly", 1);
		expect(resolve(next, "yearly").path).toBe("Journal/2027/2027.md");
	});
});
