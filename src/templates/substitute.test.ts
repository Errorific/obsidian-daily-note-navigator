import { describe, expect, it } from "vitest";
import type { Context } from "./context";
import { substituteMarkers } from "./substitute";

const SAMPLE: Context = {
	period: "daily",
	year: "2026",
	quarter: "2",
	week: "20",
	anchor_date: "2026-05-11",
	folder: "Journal/2026/Q2/W20",
	filename: "2026-05-11",
	path: "Journal/2026/Q2/W20/2026-05-11.md",
};

describe("substituteMarkers - known markers", () => {
	it.each<{ marker: string; value: string }>([
		{ marker: "{{dnn.period}}", value: "daily" },
		{ marker: "{{dnn.year}}", value: "2026" },
		{ marker: "{{dnn.quarter}}", value: "2" },
		{ marker: "{{dnn.week}}", value: "20" },
		{ marker: "{{dnn.anchor_date}}", value: "2026-05-11" },
		{ marker: "{{dnn.folder}}", value: "Journal/2026/Q2/W20" },
		{ marker: "{{dnn.filename}}", value: "2026-05-11" },
		{ marker: "{{dnn.path}}", value: "Journal/2026/Q2/W20/2026-05-11.md" },
	])("$marker -> $value", ({ marker, value }) => {
		expect(substituteMarkers(marker, SAMPLE)).toBe(value);
	});

	it("substitutes every marker in one pass over a realistic template", () => {
		const template = [
			"---",
			"period: {{dnn.period}}",
			"date: {{dnn.anchor_date}}",
			"path: {{dnn.path}}",
			"---",
			"",
			"# {{dnn.year}}-W{{dnn.week}} (Q{{dnn.quarter}})",
			"",
			"Filed under {{dnn.folder}} as {{dnn.filename}}.",
		].join("\n");
		const expected = [
			"---",
			"period: daily",
			"date: 2026-05-11",
			"path: Journal/2026/Q2/W20/2026-05-11.md",
			"---",
			"",
			"# 2026-W20 (Q2)",
			"",
			"Filed under Journal/2026/Q2/W20 as 2026-05-11.",
		].join("\n");
		expect(substituteMarkers(template, SAMPLE)).toBe(expected);
	});

	it("replaces multiple occurrences of the same marker", () => {
		const template = "{{dnn.year}}/{{dnn.year}}/{{dnn.year}}";
		expect(substituteMarkers(template, SAMPLE)).toBe("2026/2026/2026");
	});
});

describe("substituteMarkers - unknown markers", () => {
	it("leaves an unknown marker untouched", () => {
		expect(substituteMarkers("Year is {{dnn.yera}}", SAMPLE)).toBe(
			"Year is {{dnn.yera}}",
		);
	});

	it("substitutes known markers and preserves unknown ones in the same string", () => {
		expect(
			substituteMarkers("{{dnn.year}} / {{dnn.unknown}}", SAMPLE),
		).toBe("2026 / {{dnn.unknown}}");
	});

	it("does not collapse the dnn namespace prefix on its own", () => {
		expect(substituteMarkers("{{dnn}}", SAMPLE)).toBe("{{dnn}}");
	});
});

describe("substituteMarkers - non-marker content", () => {
	it("returns an empty string unchanged", () => {
		expect(substituteMarkers("", SAMPLE)).toBe("");
	});

	it("returns a template with no markers unchanged", () => {
		const template = "# Hello\n\nNo markers in here.";
		expect(substituteMarkers(template, SAMPLE)).toBe(template);
	});

	it("does not touch Templater syntax", () => {
		const template = "<% tp.date.now() %> in {{dnn.year}}";
		expect(substituteMarkers(template, SAMPLE)).toBe(
			"<% tp.date.now() %> in 2026",
		);
	});

	it("does not touch core Templates plugin markers", () => {
		const template = "{{date}} vs {{dnn.anchor_date}}";
		expect(substituteMarkers(template, SAMPLE)).toBe(
			"{{date}} vs 2026-05-11",
		);
	});
});
