// Impure vault helpers: existence check and idempotent file/folder creation.
//
// See docs/design/templates.md "Creation flow" for how these are composed
// with the Templater integration. The functions here do not touch templates
// themselves; that lives in ./templates.ts and src/templater/.

import type { App, TAbstractFile, TFile, TFolder } from "obsidian";
import type { Resolved } from "../dates/resolver";

export function exists(app: App, resolved: Resolved): boolean {
	return app.vault.getAbstractFileByPath(resolved.path) !== null;
}

export async function ensureFolder(app: App, folder: string): Promise<TFolder> {
	const existing = app.vault.getAbstractFileByPath(folder);
	if (existing !== null) {
		if (!isFolder(existing)) {
			throw new Error(
				`Cannot create folder '${folder}': path exists and is not a folder`,
			);
		}
		return existing;
	}
	return await app.vault.createFolder(folder);
}

export async function createEmpty(app: App, path: string): Promise<TFile> {
	const slash = path.lastIndexOf("/");
	if (slash > 0) {
		await ensureFolder(app, path.slice(0, slash));
	}
	return await app.vault.create(path, "");
}

function isFolder(file: TAbstractFile): file is TFolder {
	// TFolder has `children`; TFile does not. The obsidian npm package is
	// types-only, so `instanceof TFolder` would fail in unit tests.
	return "children" in file;
}
