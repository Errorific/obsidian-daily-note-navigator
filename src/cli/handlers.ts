// CLI subcommand handlers. Pure functions over the public Obsidian App
// surface (plus a settings getter), so they can be tested without spinning
// up a plugin instance.
//
// Output formatting follows docs/design/cli-surface.md: text mode returns
// a single line; JSON mode returns {"ok":true,...} or {"ok":false,"error":"..."}.
// All thrown errors are caught at the handler boundary and turned into one
// of those two forms; nothing escapes to the CLI runtime.

import type { App, CliData, TFile } from "obsidian";
import { type Period, resolve } from "../dates/resolver";
import { parseRef } from "../dates/refs";
import type { Settings } from "../settings";
import { createNote } from "../templater/create";
import { exists } from "../vault/notes";
import { isFile } from "../vault/predicates";

export interface CliDeps {
	app: App;
	getSettings: () => Settings;
}

type Format = "text" | "json";

const PERIODS: ReadonlyArray<Period> = [
	"daily",
	"weekly",
	"quarterly",
	"yearly",
];

export async function handlePath(
	_deps: CliDeps,
	params: CliData,
): Promise<string> {
	return runWithFormatting(params, (format) => {
		const { anchor, period } = parseSelectors(params);
		const resolved = resolve(anchor, period);
		if (format === "json") {
			return JSON.stringify({ ok: true, path: resolved.path });
		}
		return resolved.path;
	});
}

export async function handleExists(
	deps: CliDeps,
	params: CliData,
): Promise<string> {
	return runWithFormatting(params, (format) => {
		const { anchor, period } = parseSelectors(params);
		const resolved = resolve(anchor, period);
		const present = exists(deps.app, resolved);
		if (format === "json") {
			return JSON.stringify({
				ok: true,
				path: resolved.path,
				exists: present,
			});
		}
		return `${present ? "exists" : "missing"}: ${resolved.path}`;
	});
}

export async function handleFind(
	deps: CliDeps,
	params: CliData,
): Promise<string> {
	return runWithFormatting(params, async (format) => {
		const { anchor, period } = parseSelectors(params);
		const resolved = resolve(anchor, period);
		const wantCreate = params.create === "true";
		const wantOpen = params.open === "true";
		const wantNewTab = params.newtab === "true";
		const existedBefore = exists(deps.app, resolved);

		let file: TFile | undefined;
		let created = false;
		if (existedBefore) {
			const existing = deps.app.vault.getAbstractFileByPath(resolved.path);
			if (existing !== null && isFile(existing)) {
				file = existing;
			}
		} else if (wantCreate) {
			const templatePath = pickTemplate(params, period, deps.getSettings());
			file = await createNote(deps.app, resolved, {
				anchor,
				period,
				templatePath,
			});
			created = true;
		}

		let opened = false;
		if (wantOpen && file !== undefined) {
			const leaf = deps.app.workspace.getLeaf(wantNewTab ? "tab" : false);
			await leaf.openFile(file);
			opened = true;
		}

		if (format === "json") {
			return JSON.stringify({
				ok: true,
				path: resolved.path,
				existed: existedBefore,
				created,
				opened,
			});
		}
		if (created) return `created: ${resolved.path}`;
		if (existedBefore) return `existed: ${resolved.path}`;
		return `missing: ${resolved.path}`;
	});
}

async function runWithFormatting(
	params: CliData,
	body: (format: Format) => string | Promise<string>,
): Promise<string> {
	let format: Format;
	try {
		format = parseFormat(params);
	} catch (err) {
		// A format-flag error happens before we know which envelope to use,
		// so it always reports as text. Subsequent errors honour `format`.
		return `Error: ${messageOf(err)}`;
	}
	try {
		return await body(format);
	} catch (err) {
		const msg = messageOf(err);
		if (format === "json") {
			return JSON.stringify({ ok: false, error: msg });
		}
		return `Error: ${msg}`;
	}
}

function parseFormat(params: CliData): Format {
	const raw = params.format;
	if (raw === undefined) return "text";
	if (raw === "true") {
		throw new Error("format requires a value (text or json)");
	}
	if (raw === "text") return "text";
	if (raw === "json") return "json";
	throw new Error(`unknown format '${raw}' (expected text or json)`);
}

function parseSelectors(params: CliData): { anchor: Date; period: Period } {
	const periodRaw = params.period;
	if (periodRaw === undefined) {
		throw new Error("period is required");
	}
	if (!isPeriod(periodRaw)) {
		throw new Error(
			`unknown period '${periodRaw}' (expected ${PERIODS.join(", ")})`,
		);
	}
	const period: Period = periodRaw;

	const date = requireValue("date", params.date);
	const ref = requireValue("ref", params.ref);
	if (date !== undefined && ref !== undefined) {
		throw new Error("date and ref are mutually exclusive");
	}

	let anchor: Date;
	if (date !== undefined) {
		anchor = parseIsoDate(date);
	} else if (ref !== undefined) {
		anchor = parseRef(ref, period);
	} else {
		anchor = today();
	}
	return { anchor, period };
}

function pickTemplate(
	params: CliData,
	period: Period,
	settings: Settings,
): string | undefined {
	const override = requireValue("template", params.template);
	if (override !== undefined) return override;
	return settings.templates[period];
}

function isPeriod(value: string): value is Period {
	return (PERIODS as readonly string[]).includes(value);
}

function requireValue(
	name: string,
	value: string | undefined,
): string | undefined {
	if (value === undefined) return undefined;
	if (value === "true") {
		throw new Error(`${name} requires a value`);
	}
	return value;
}

function parseIsoDate(date: string): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (!match) {
		throw new Error(`date '${date}' is not a valid ISO date (YYYY-MM-DD)`);
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const d = new Date(year, month - 1, day, 12, 0, 0, 0);
	if (
		d.getFullYear() !== year ||
		d.getMonth() !== month - 1 ||
		d.getDate() !== day
	) {
		throw new Error(`date '${date}' is not a valid ISO date (YYYY-MM-DD)`);
	}
	return d;
}

function today(): Date {
	const now = new Date();
	return new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		12,
		0,
		0,
		0,
	);
}

function messageOf(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}
