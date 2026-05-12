// Loads template files from the vault. See docs/design/templates.md
// "Read the template file" for the failure semantics: a missing template
// is an error, not a silent fallback to empty creation.

import type { App, TAbstractFile, TFile } from "obsidian";

export class TemplateNotFoundError extends Error {
	readonly path: string;

	constructor(path: string) {
		super(`template '${path}' not found`);
		this.name = "TemplateNotFoundError";
		this.path = path;
	}
}

export async function loadTemplate(
	app: App,
	vaultRelativePath: string,
): Promise<string> {
	const file = app.vault.getAbstractFileByPath(vaultRelativePath);
	if (file === null || !isFile(file)) {
		throw new TemplateNotFoundError(vaultRelativePath);
	}
	return await app.vault.read(file);
}

function isFile(file: TAbstractFile): file is TFile {
	return "extension" in file;
}
