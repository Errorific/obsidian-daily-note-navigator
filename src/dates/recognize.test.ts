import { describe, expect, it } from "vitest";
import { recognizePath } from "./recognize";
import { resolve } from "./resolver";

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

describe("recognizePath -- happy paths", () => {
	it("recognises a daily note and anchors to the filename's date", () => {
		const result = recognizePath("Journal/2026/Q2/W20/2026-05-11 Monday.md");
		expect(result).toEqual({ period: "daily", anchor: localDate(2026, 4, 11) });
	});

	it("recognises a weekly note and anchors to the Monday of the ISO week", () => {
		const result = recognizePath("Journal/2026/Q2/W20/W20.md");
		expect(result).toEqual({ period: "weekly", anchor: localDate(2026, 4, 11) });
	});

	it("recognises a quarterly note", () => {
		const result = recognizePath("Journal/2026/Q2/Q2.md");
		expect(result?.period).toBe("quarterly");
		// Mid-month of the middle month of Q2 = May 15
		expect(result?.anchor).toEqual(localDate(2026, 4, 15));
	});

	it("recognises a yearly note", () => {
		const result = recognizePath("Journal/2026/2026.md");
		expect(result).toEqual({
			period: "yearly",
			anchor: localDate(2026, 6, 1),
		});
	});

	it("round-trips: recognised anchor resolved by resolve() returns the same path", () => {
		for (const path of [
			"Journal/2026/Q2/W20/2026-05-11 Monday.md",
			"Journal/2026/Q2/W20/W20.md",
			"Journal/2026/Q2/Q2.md",
			"Journal/2026/2026.md",
		]) {
			const recognized = recognizePath(path);
			expect(recognized).toBeDefined();
			const re = resolve(recognized!.anchor, recognized!.period);
			expect(re.path).toBe(path);
		}
	});
});

describe("recognizePath -- non-matching paths", () => {
	it("returns undefined for files outside the Journal root", () => {
		expect(recognizePath("Notes/2026/Q2/W20/2026-05-11 Monday.md")).toBeUndefined();
	});

	it("returns undefined for a daily filename in the wrong folder depth", () => {
		// Missing the W?? folder
		expect(recognizePath("Journal/2026/Q2/2026-05-11 Monday.md")).toBeUndefined();
	});

	it("returns undefined when the weekly filename and folder do not agree", () => {
		expect(recognizePath("Journal/2026/Q2/W19/W20.md")).toBeUndefined();
	});

	it("returns undefined when the quarterly filename and folder do not agree", () => {
		expect(recognizePath("Journal/2026/Q1/Q2.md")).toBeUndefined();
	});

	it("returns undefined when the yearly filename and folder do not agree", () => {
		expect(recognizePath("Journal/2026/2027.md")).toBeUndefined();
	});

	it("returns undefined for an invalid date in a daily filename", () => {
		expect(
			recognizePath("Journal/2026/Q2/W20/2026-02-30 Monday.md"),
		).toBeUndefined();
	});

	it("returns undefined when the day name does not match the date", () => {
		// 2026-05-11 is a Monday, not Tuesday.
		expect(
			recognizePath("Journal/2026/Q2/W20/2026-05-11 Tuesday.md"),
		).toBeUndefined();
	});

	it("returns undefined for a bare YYYY-MM-DD daily filename (legacy format)", () => {
		expect(recognizePath("Journal/2026/Q2/W20/2026-05-11.md")).toBeUndefined();
	});

	it("returns undefined for an out-of-range ISO week (W53 of 2025)", () => {
		// 2025 only has W01-W52; the resolver would never produce W53.md here.
		expect(recognizePath("Journal/2025/Q4/W53/W53.md")).toBeUndefined();
	});

	it("returns undefined for unrelated files in the Journal hierarchy", () => {
		expect(recognizePath("Journal/notes.md")).toBeUndefined();
		expect(recognizePath("Journal/2026/Q2/W20/scratch.md")).toBeUndefined();
	});

	it("accepts a custom root", () => {
		const result = recognizePath(
			"Custom/2026/Q2/W20/2026-05-11 Monday.md",
			"Custom",
		);
		expect(result?.period).toBe("daily");
		expect(recognizePath("Custom/2026/2026.md", "Journal")).toBeUndefined();
	});
});
