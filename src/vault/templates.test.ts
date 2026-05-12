import { describe, expect, it } from "vitest";
import { makeApp } from "./fakes";
import { TemplateNotFoundError, loadTemplate } from "./templates";

describe("loadTemplate", () => {
	it("returns the content of an existing template file", async () => {
		const { app, vault } = makeApp();
		vault.folders.add("Templates");
		vault.files.set("Templates/Daily.md", "# {{dnn.anchor_date}}");
		expect(await loadTemplate(app, "Templates/Daily.md")).toBe(
			"# {{dnn.anchor_date}}",
		);
	});

	it("returns an empty string for an empty template", async () => {
		const { app, vault } = makeApp();
		vault.files.set("Templates/Bare.md", "");
		expect(await loadTemplate(app, "Templates/Bare.md")).toBe("");
	});

	it("throws TemplateNotFoundError when the path does not exist", async () => {
		const { app } = makeApp();
		await expect(loadTemplate(app, "Templates/Missing.md")).rejects.toThrow(
			TemplateNotFoundError,
		);
		await expect(loadTemplate(app, "Templates/Missing.md")).rejects.toThrow(
			"template 'Templates/Missing.md' not found",
		);
	});

	it("throws TemplateNotFoundError when the path is a folder, not a file", async () => {
		const { app, vault } = makeApp();
		vault.folders.add("Templates");
		await expect(loadTemplate(app, "Templates")).rejects.toThrow(
			TemplateNotFoundError,
		);
	});

	it("the thrown error exposes the offending path", async () => {
		const { app } = makeApp();
		try {
			await loadTemplate(app, "Templates/Daily.md");
			expect.fail("expected loadTemplate to throw");
		} catch (err) {
			expect(err).toBeInstanceOf(TemplateNotFoundError);
			expect((err as TemplateNotFoundError).path).toBe(
				"Templates/Daily.md",
			);
		}
	});
});
