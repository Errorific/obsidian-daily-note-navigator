// Impure vault helpers: existence check and idempotent file/folder creation.
//
// See docs/design/templates.md "Creation flow" for how these are composed
// with the Templater integration. The functions here do not touch templates
// themselves; that lives in ./templates.ts and src/templater/.

import type { App, TFile, TFolder } from "obsidian";
import type { Resolved } from "../dates/resolver";
import { isFile, isFolder } from "./predicates";

export function exists(app: App, resolved: Resolved): boolean {
	const file = app.vault.getAbstractFileByPath(resolved.path);
	return file !== null && isFile(file);
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
