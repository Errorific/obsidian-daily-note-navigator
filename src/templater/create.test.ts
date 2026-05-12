import { describe, expect, it, vi } from "vitest";
import { resolve } from "../dates/resolver";
import { TemplateNotFoundError } from "../vault/templates";
import { makeApp } from "../vault/fakes";
import { createNote } from "./create";
import { FakeTemplater, installTemplater } from "./fakes";

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

const ANCHOR = localDate(2026, 4, 11);
const RESOLVED = resolve(ANCHOR, "daily");

describe("createNote -- existing note is idempotent", () => {
	it("returns the existing file without modifying it", async () => {
		const { app, vault } = makeApp();
		vault.folders.add(RESOLVED.folder);
		vault.files.set(RESOLVED.path, "existing content");

		const file = await createNote(app, RESOLVED, {
			anchor: ANCHOR,
			period: "daily",
			templatePath: "Templates/Daily.md", // configured but ignored
		});

		expect(file.path).toBe(RESOLVED.path);
		expect(vault.files.get(RESOLVED.path)).toBe("existing content");
	});

	it("throws when the path exists as a folder", async () => {
		const { app, vault } = makeApp();
		vault.folders.add(RESOLVED.path);
		await expect(
			createNote(app, RESOLVED, { anchor: ANCHOR, period: "daily" }),
		).rejects.toThrow("path exists and is not a file");
	});
});

describe("createNote -- empty-creation path", () => {
	it("creates an empty file when no template is configured and no Templater is installed", async () => {
		const { app, vault } = makeApp();
		const file = await createNote(app, RESOLVED, {
			anchor: ANCHOR,
			period: "daily",
		});
		expect(file.path).toBe(RESOLVED.path);
		expect(vault.files.get(RESOLVED.path)).toBe("");
		expect(vault.folders.has(RESOLVED.folder)).toBe(true);
	});

	it("still guards via Templater's pending set in the empty-creation path", async () => {
		const { app, vault } = makeApp();
		const templater = new FakeTemplater();
		installTemplater(app, templater);

		await createNote(app, RESOLVED, { anchor: ANCHOR, period: "daily" });

		expect(templater.addedPaths).toEqual([RESOLVED.path]);
		expect(templater.deletedPaths).toEqual([RESOLVED.path]);
		expect(templater.files_with_pending_templates.has(RESOLVED.path)).toBe(false);
		expect(vault.files.get(RESOLVED.path)).toBe("");
	});
});

describe("createNote -- plain template (no Templater)", () => {
	it("substitutes markers and writes the template content", async () => {
		const { app, vault } = makeApp();
		vault.folders.add("Templates");
		vault.files.set(
			"Templates/Daily.md",
			"# {{dnn.anchor_date}} ({{dnn.period}})\n\nin {{dnn.folder}}\n",
		);

		const file = await createNote(app, RESOLVED, {
			anchor: ANCHOR,
			period: "daily",
			templatePath: "Templates/Daily.md",
		});

		expect(file.path).toBe(RESOLVED.path);
		expect(vault.files.get(RESOLVED.path)).toBe(
			"# 2026-05-11 (daily)\n\nin Journal/2026/Q2/W20\n",
		);
	});

	it("throws TemplateNotFoundError and creates no file when the template path is missing", async () => {
		const { app, vault } = makeApp();
		await expect(
			createNote(app, RESOLVED, {
				anchor: ANCHOR,
				period: "daily",
				templatePath: "Templates/Missing.md",
			}),
		).rejects.toBeInstanceOf(TemplateNotFoundError);
		expect(vault.files.has(RESOLVED.path)).toBe(false);
	});
});

describe("createNote -- Templater integration", () => {
	it("calls parse_template with the substituted content and writes its result", async () => {
		const { app, vault } = makeApp();
		vault.folders.add("Templates");
		vault.files.set(
			"Templates/Daily.md",
			"period={{dnn.period}}\n<% tp.date.now() %>\n",
		);
		const templater = new FakeTemplater();
		templater.parseImpl = async (config, content) => {
			expect(config.target_file.path).toBe(RESOLVED.path);
			expect(config.template_file?.path).toBe("Templates/Daily.md");
			expect(content).toBe("period=daily\n<% tp.date.now() %>\n");
			return content.replace("<% tp.date.now() %>", "2026-05-11");
		};
		installTemplater(app, templater);

		await createNote(app, RESOLVED, {
			anchor: ANCHOR,
			period: "daily",
			templatePath: "Templates/Daily.md",
		});

		expect(vault.files.get(RESOLVED.path)).toBe("period=daily\n2026-05-11\n");
		expect(templater.addedPaths).toEqual([RESOLVED.path]);
		expect(templater.deletedPaths).toEqual([RESOLVED.path]);
	});

	it("rolls back the empty placeholder and wraps the error on Templater failure", async () => {
		const { app, vault } = makeApp();
		vault.folders.add("Templates");
		vault.files.set("Templates/Daily.md", "<% invalid %>");
		const templater = new FakeTemplater();
		templater.parseImpl = async () => {
			throw new Error("Template parsing error: unexpected token at line 3");
		};
		installTemplater(app, templater);

		await expect(
			createNote(app, RESOLVED, {
				anchor: ANCHOR,
				period: "daily",
				templatePath: "Templates/Daily.md",
			}),
		).rejects.toThrow(
			"Templater: Template parsing error: unexpected token at line 3",
		);

		expect(vault.files.has(RESOLVED.path)).toBe(false);
		// Guard still cleaned up even though the inner call threw.
		expect(templater.deletedPaths).toEqual([RESOLVED.path]);
		expect(templater.files_with_pending_templates.has(RESOLVED.path)).toBe(false);
	});

	it("works without the pending-set guard when Templater's set is missing", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { app, vault } = makeApp();
		vault.folders.add("Templates");
		vault.files.set("Templates/Daily.md", "hello {{dnn.period}}");
		const templater = new FakeTemplater();
		(
			templater as unknown as { files_with_pending_templates: unknown }
		).files_with_pending_templates = undefined;
		templater.parseImpl = async (_config, content) => `parsed: ${content}`;
		installTemplater(app, templater);

		const file = await createNote(app, RESOLVED, {
			anchor: ANCHOR,
			period: "daily",
			templatePath: "Templates/Daily.md",
		});

		expect(file.path).toBe(RESOLVED.path);
		expect(vault.files.get(RESOLVED.path)).toBe("parsed: hello daily");
		warn.mockRestore();
	});
});
