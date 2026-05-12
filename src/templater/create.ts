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
//
// Timing note: Templater's create-trigger handler does `await delay(300)`
// before it checks `files_with_pending_templates`. If we remove our entry
// from the set synchronously after `vault.create` returns (which happens
// in the empty-creation path -- there is no parse_template / modify to
// keep us busy), the entry is gone by the time Templater's timer fires
// and the folder template overwrites our just-created note. We therefore
// defer the pending-set delete by PENDING_SET_RELEASE_MS so it outlasts
// Templater's wait window. The created TFile is still returned to the
// caller synchronously; the deferred cleanup runs in the background.

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

// Templater's folder-template trigger waits 300ms before checking the
// pending set. We hold our entry comfortably longer so the entry is still
// present when Templater's timer fires. Exposed for tests via setter below.
export let PENDING_SET_RELEASE_MS = 500;

export function _setPendingSetReleaseMsForTests(ms: number): void {
	PENDING_SET_RELEASE_MS = ms;
}

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

	let scheduledRelease = false;
	const releasePendingSet = () => {
		if (scheduledRelease || pendingSet === undefined) return;
		scheduledRelease = true;
		// Deferred: outlast Templater's 300ms delay(...) inside its trigger
		// handler. See the file header for the race this prevents.
		setTimeout(() => {
			pendingSet.delete(resolved.path);
		}, PENDING_SET_RELEASE_MS);
	};

	try {
		const target = await createEmpty(app, resolved.path);

		if (substituted === undefined) {
			releasePendingSet();
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
		releasePendingSet();
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
