import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliData } from "obsidian";
import type { Settings } from "../settings";
import { resolve } from "../dates/resolver";
import { FakeTemplater, installTemplater } from "../templater/fakes";
import { makeApp } from "../vault/fakes";
import { type CliDeps, handleExists, handleFind, handlePath } from "./handlers";

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function settingsWith(
	templates: Settings["templates"] = {},
): Settings {
	return { templates };
}

function depsFrom(
	bundle: ReturnType<typeof makeApp>,
	settings: Settings = settingsWith(),
): CliDeps {
	return { app: bundle.app, getSettings: () => settings };
}

function params(rec: Record<string, string>): CliData {
	return rec as CliData;
}

const DAILY_2026_05_11 = resolve(localDate(2026, 4, 11), "daily");
const WEEKLY_W20_2026 = resolve(localDate(2026, 4, 11), "weekly");
const QUARTERLY_Q2_2026 = resolve(localDate(2026, 4, 11), "quarterly");
const YEARLY_2026 = resolve(localDate(2026, 4, 11), "yearly");

describe("handlePath", () => {
	it("returns the resolved path for a daily note", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(deps, params({ period: "daily", date: "2026-05-11" }));
		expect(out).toBe(DAILY_2026_05_11.path);
	});

	it("returns JSON when format=json", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(
			deps,
			params({ period: "daily", date: "2026-05-11", format: "json" }),
		);
		expect(JSON.parse(out)).toEqual({ ok: true, path: DAILY_2026_05_11.path });
	});

	it("resolves weekly refs", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(deps, params({ period: "weekly", ref: "2026/W20" }));
		expect(out).toBe(WEEKLY_W20_2026.path);
	});

	it("resolves quarterly refs", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(deps, params({ period: "quarterly", ref: "2026/Q2" }));
		expect(out).toBe(QUARTERLY_Q2_2026.path);
	});

	it("resolves yearly refs", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(deps, params({ period: "yearly", ref: "2026" }));
		expect(out).toBe(YEARLY_2026.path);
	});

	it("defaults to today when neither date nor ref is given", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(localDate(2026, 4, 11));
		try {
			const deps = depsFrom(makeApp());
			const out = await handlePath(deps, params({ period: "daily" }));
			expect(out).toBe(DAILY_2026_05_11.path);
		} finally {
			vi.useRealTimers();
		}
	});

	it("errors when both date and ref are given", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(
			deps,
			params({ period: "daily", date: "2026-05-11", ref: "2026-05-11" }),
		);
		expect(out).toBe("Error: date and ref are mutually exclusive");
	});

	it("errors when period is missing", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(deps, params({}));
		expect(out).toBe("Error: period is required");
	});

	it("errors on unknown period", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(deps, params({ period: "monthly" }));
		expect(out).toBe(
			"Error: unknown period 'monthly' (expected daily, weekly, quarterly, yearly)",
		);
	});

	it("errors on invalid date", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(
			deps,
			params({ period: "daily", date: "2026-13-99" }),
		);
		expect(out).toBe("Error: date '2026-13-99' is not a valid ISO date (YYYY-MM-DD)");
	});

	it("errors on invalid ref for the period", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(
			deps,
			params({ period: "weekly", ref: "2026/Q2" }),
		);
		expect(out).toBe("Error: ref '2026/Q2' is not valid for period 'weekly'");
	});

	it("errors on unknown format in text mode", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(
			deps,
			params({ period: "daily", format: "xml" }),
		);
		expect(out).toBe("Error: unknown format 'xml' (expected text or json)");
	});

	it("returns JSON error envelope when format=json fails downstream", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(
			deps,
			params({ period: "monthly", format: "json" }),
		);
		expect(JSON.parse(out)).toEqual({
			ok: false,
			error:
				"unknown period 'monthly' (expected daily, weekly, quarterly, yearly)",
		});
	});
});

describe("handleExists", () => {
	it("reports exists when the file is present", async () => {
		const bundle = makeApp();
		bundle.vault.folders.add(DAILY_2026_05_11.folder);
		bundle.vault.files.set(DAILY_2026_05_11.path, "");
		const out = await handleExists(
			depsFrom(bundle),
			params({ period: "daily", date: "2026-05-11" }),
		);
		expect(out).toBe(`exists: ${DAILY_2026_05_11.path}`);
	});

	it("reports missing when the file is absent", async () => {
		const out = await handleExists(
			depsFrom(makeApp()),
			params({ period: "daily", date: "2026-05-11" }),
		);
		expect(out).toBe(`missing: ${DAILY_2026_05_11.path}`);
	});

	it("returns structured JSON", async () => {
		const out = await handleExists(
			depsFrom(makeApp()),
			params({ period: "daily", date: "2026-05-11", format: "json" }),
		);
		expect(JSON.parse(out)).toEqual({
			ok: true,
			path: DAILY_2026_05_11.path,
			exists: false,
		});
	});
});

describe("handleFind -- read-only paths", () => {
	it("reports existed for an already-present note without opening it", async () => {
		const bundle = makeApp();
		bundle.vault.folders.add(DAILY_2026_05_11.folder);
		bundle.vault.files.set(DAILY_2026_05_11.path, "content");

		const out = await handleFind(
			depsFrom(bundle),
			params({ period: "daily", date: "2026-05-11" }),
		);
		expect(out).toBe(`existed: ${DAILY_2026_05_11.path}`);
		expect(bundle.workspace.opens).toEqual([]);
		expect(bundle.vault.files.get(DAILY_2026_05_11.path)).toBe("content");
	});

	it("reports missing when create is not requested", async () => {
		const bundle = makeApp();
		const out = await handleFind(
			depsFrom(bundle),
			params({ period: "daily", date: "2026-05-11" }),
		);
		expect(out).toBe(`missing: ${DAILY_2026_05_11.path}`);
		expect(bundle.vault.files.has(DAILY_2026_05_11.path)).toBe(false);
	});
});

describe("handleFind -- creation", () => {
	it("creates an empty note when no template is configured", async () => {
		const bundle = makeApp();
		const out = await handleFind(
			depsFrom(bundle),
			params({ period: "daily", date: "2026-05-11", create: "true" }),
		);
		expect(out).toBe(`created: ${DAILY_2026_05_11.path}`);
		expect(bundle.vault.files.get(DAILY_2026_05_11.path)).toBe("");
	});

	it("uses the period's configured template", async () => {
		const bundle = makeApp();
		bundle.vault.folders.add("Templates");
		bundle.vault.files.set(
			"Templates/Daily.md",
			"# {{dnn.anchor_date}}\n",
		);
		const out = await handleFind(
			depsFrom(bundle, settingsWith({ daily: "Templates/Daily.md" })),
			params({ period: "daily", date: "2026-05-11", create: "true" }),
		);
		expect(out).toBe(`created: ${DAILY_2026_05_11.path}`);
		expect(bundle.vault.files.get(DAILY_2026_05_11.path)).toBe(
			"# 2026-05-11\n",
		);
	});

	it("template= overrides the configured template", async () => {
		const bundle = makeApp();
		bundle.vault.folders.add("Templates");
		bundle.vault.files.set("Templates/Bare.md", "bare\n");
		bundle.vault.files.set(
			"Templates/Daily.md",
			"would not see this\n",
		);
		const out = await handleFind(
			depsFrom(bundle, settingsWith({ daily: "Templates/Daily.md" })),
			params({
				period: "daily",
				date: "2026-05-11",
				create: "true",
				template: "Templates/Bare.md",
			}),
		);
		expect(out).toBe(`created: ${DAILY_2026_05_11.path}`);
		expect(bundle.vault.files.get(DAILY_2026_05_11.path)).toBe("bare\n");
	});

	it("returns the template-not-found error without creating the file", async () => {
		const bundle = makeApp();
		const out = await handleFind(
			depsFrom(bundle, settingsWith({ daily: "Templates/Missing.md" })),
			params({ period: "daily", date: "2026-05-11", create: "true" }),
		);
		expect(out).toBe("Error: template 'Templates/Missing.md' not found");
		expect(bundle.vault.files.has(DAILY_2026_05_11.path)).toBe(false);
	});

	it("surfaces Templater errors with the documented prefix", async () => {
		const bundle = makeApp();
		bundle.vault.folders.add("Templates");
		bundle.vault.files.set("Templates/Daily.md", "<% bad %>");
		const templater = new FakeTemplater();
		templater.parseImpl = async () => {
			throw new Error("Template parsing error: unexpected token");
		};
		installTemplater(bundle.app, templater);

		const out = await handleFind(
			depsFrom(bundle, settingsWith({ daily: "Templates/Daily.md" })),
			params({
				period: "daily",
				date: "2026-05-11",
				create: "true",
				format: "json",
			}),
		);
		expect(JSON.parse(out)).toEqual({
			ok: false,
			error: "Templater: Template parsing error: unexpected token",
		});
		expect(bundle.vault.files.has(DAILY_2026_05_11.path)).toBe(false);
	});
});

describe("handleFind -- open", () => {
	it("opens an existing note in the active leaf", async () => {
		const bundle = makeApp();
		bundle.vault.folders.add(DAILY_2026_05_11.folder);
		bundle.vault.files.set(DAILY_2026_05_11.path, "");
		await handleFind(
			depsFrom(bundle),
			params({ period: "daily", date: "2026-05-11", open: "true" }),
		);
		expect(bundle.workspace.opens).toEqual([
			{ path: DAILY_2026_05_11.path, tab: false },
		]);
	});

	it("opens a freshly created note in a new tab when newtab is set", async () => {
		const bundle = makeApp();
		await handleFind(
			depsFrom(bundle),
			params({
				period: "daily",
				date: "2026-05-11",
				create: "true",
				open: "true",
				newtab: "true",
			}),
		);
		expect(bundle.workspace.opens).toEqual([
			{ path: DAILY_2026_05_11.path, tab: true },
		]);
		expect(bundle.vault.files.has(DAILY_2026_05_11.path)).toBe(true);
	});

	it("does not open when create was not requested and the file is missing", async () => {
		const bundle = makeApp();
		await handleFind(
			depsFrom(bundle),
			params({ period: "daily", date: "2026-05-11", open: "true" }),
		);
		expect(bundle.workspace.opens).toEqual([]);
	});

	it("returns JSON with the full flag set", async () => {
		const bundle = makeApp();
		const out = await handleFind(
			depsFrom(bundle),
			params({
				period: "daily",
				date: "2026-05-11",
				create: "true",
				open: "true",
				format: "json",
			}),
		);
		expect(JSON.parse(out)).toEqual({
			ok: true,
			path: DAILY_2026_05_11.path,
			existed: false,
			created: true,
			opened: true,
		});
	});
});

describe("flag-value validation", () => {
	it("rejects boolean-style usage for selector flags that require a value", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(
			deps,
			params({ period: "daily", date: "true" }),
		);
		expect(out).toBe("Error: date requires a value");
	});

	it("rejects boolean-style usage of format", async () => {
		const deps = depsFrom(makeApp());
		const out = await handlePath(
			deps,
			params({ period: "daily", format: "true" }),
		);
		expect(out).toBe("Error: format requires a value (text or json)");
	});
});

beforeEach(() => {
	vi.useRealTimers();
});

afterEach(() => {
	vi.useRealTimers();
});
