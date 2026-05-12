import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeApp } from "../vault/fakes";
import {
	_resetWarningStateForTests,
	getTemplater,
	hasPendingSet,
} from "./detect";
import { FakeTemplater, installTemplater } from "./fakes";

beforeEach(() => {
	_resetWarningStateForTests();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("getTemplater", () => {
	it("returns undefined when the app has no plugin registry", () => {
		const { app } = makeApp();
		expect(getTemplater(app)).toBeUndefined();
	});

	it("returns undefined when Templater is not installed", () => {
		const { app } = makeApp();
		(
			app as unknown as { plugins: { plugins: Record<string, unknown> } }
		).plugins = { plugins: {} };
		expect(getTemplater(app)).toBeUndefined();
	});

	it("returns undefined when the Templater plugin entry has no templater core", () => {
		const { app } = makeApp();
		(
			app as unknown as {
				plugins: { plugins: Record<string, unknown> };
			}
		).plugins = { plugins: { "templater-obsidian": {} } };
		expect(getTemplater(app)).toBeUndefined();
	});

	it("returns the templater core when present", () => {
		const { app } = makeApp();
		const templater = new FakeTemplater();
		installTemplater(app, templater);
		expect(getTemplater(app)).toBe(templater);
	});

	it("does not warn when the pending-set is a Set", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { app } = makeApp();
		installTemplater(app, new FakeTemplater());
		getTemplater(app);
		expect(warn).not.toHaveBeenCalled();
	});

	it("warns once when the pending-set is missing or wrong type", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { app } = makeApp();
		const broken = new FakeTemplater();
		(broken as unknown as { files_with_pending_templates: unknown }).files_with_pending_templates =
			undefined;
		installTemplater(app, broken);

		getTemplater(app);
		getTemplater(app);
		getTemplater(app);

		expect(warn).toHaveBeenCalledTimes(1);
		const message: unknown = warn.mock.calls[0]?.[0];
		expect(String(message)).toContain("files_with_pending_templates");
	});
});

describe("hasPendingSet", () => {
	it("is true when the property is a Set", () => {
		expect(hasPendingSet(new FakeTemplater())).toBe(true);
	});

	it("is false when the property is not a Set", () => {
		const broken = new FakeTemplater();
		(broken as unknown as { files_with_pending_templates: unknown }).files_with_pending_templates =
			{};
		expect(hasPendingSet(broken)).toBe(false);
	});
});
