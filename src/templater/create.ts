// The single canonical create flow used by the CLI and command-palette
// surfaces. See docs/design/templates.md "Creation flow" for the diagram
// and step-by-step this implements.
//
// Responsibilities:
//   - Idempotent: an existing note is returned without modification.
//   - Template substitution runs before any vault write.
//   - The Templater pending-set guard wraps the create+modify so a folder
//     template configured on the journal root cannot overwrite our work.
//   - On Templater parse failure the empty placeholder is rolled back so
//     the user is left in their original state.

import type { App, TFile } from "obsidian";
import type { Period, Resolved } from "../dates/resolver";
import { buildContext } from "../templates/context";
import { substituteMarkers } from "../templates/substitute";
import { createEmpty } from "../vault/notes";
import { isFile } from "../vault/predicates";
import { getTemplateFile } from "../vault/templates";
import {
	TEMPLATER_RUN_MODE_CREATE_NEW_FROM_TEMPLATE,
	getTemplater,
	hasPendingSet,
} from "./detect";

export interface CreateNoteOptions {
	anchor: Date;
	period: Period;
	// Vault-relative path to the template file. Omit for the empty-creation
	// path. A non-existent path raises TemplateNotFoundError; we do not fall
	// back to empty creation, because that would silently mask the bug.
	templatePath?: string;
}

export async function createNote(
	app: App,
	resolved: Resolved,
	options: CreateNoteOptions,
): Promise<TFile> {
	const existing = app.vault.getAbstractFileByPath(resolved.path);
	if (existing !== null) {
		if (!isFile(existing)) {
			throw new Error(
				`Cannot create note at '${resolved.path}': path exists and is not a file`,
			);
		}
		return existing;
	}

	let substituted: string | undefined;
	let templateFile: TFile | undefined;
	if (options.templatePath !== undefined) {
		templateFile = getTemplateFile(app, options.templatePath);
		const raw = await app.vault.read(templateFile);
		const context = buildContext(options.anchor, options.period, resolved);
		substituted = substituteMarkers(raw, context);
	}

	const templater = getTemplater(app);
	// The pending-set guard is feature-detected: a future Templater that
	// renames or removes the set degrades to a no-op rather than crashing.
	const pendingSet =
		templater !== undefined && hasPendingSet(templater)
			? templater.files_with_pending_templates
			: undefined;
	pendingSet?.add(resolved.path);

	try {
		const target = await createEmpty(app, resolved.path);

		if (substituted === undefined) {
			return target;
		}

		let rendered: string;
		if (templater !== undefined && templateFile !== undefined) {
			try {
				const config = templater.create_running_config(
					templateFile,
					target,
					TEMPLATER_RUN_MODE_CREATE_NEW_FROM_TEMPLATE,
				);
				rendered = await templater.parse_template(config, substituted);
			} catch (err) {
				await tryDelete(app, target);
				throw new Error(`Templater: ${messageOf(err)}`);
			}
		} else {
			rendered = substituted;
		}

		await app.vault.modify(target, rendered);
		return target;
	} finally {
		pendingSet?.delete(resolved.path);
	}
}

async function tryDelete(app: App, file: TFile): Promise<void> {
	try {
		// Hard delete is intentional: the file is the empty placeholder
		// we just created and never wrote real content to. Trashing it
		// would surface our internal failure to the user's trash.
		// Templater follows the same convention in
		// create_new_note_from_template.
		// eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file
		await app.vault.delete(file);
	} catch {
		// Best-effort: a dangling empty file is preferable to swallowing
		// the original Templater error.
	}
}

function messageOf(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}
