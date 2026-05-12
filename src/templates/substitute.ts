// Pure {{dnn.*}} marker substitution. See docs/design/templates.md.
//
// Runs before Templater (or in place of it when Templater isn't installed).
// Unknown markers are intentionally left as-is: silently replacing typos with
// empty strings hides bugs in user templates.

import type { Context } from "./context";

const MARKER_KEYS: ReadonlyArray<keyof Context> = [
	"period",
	"year",
	"quarter",
	"week",
	"anchor_date",
	"folder",
	"filename",
	"path",
];

export function substituteMarkers(template: string, context: Context): string {
	let result = template;
	for (const key of MARKER_KEYS) {
		result = result.replaceAll(`{{dnn.${key}}}`, context[key]);
	}
	return result;
}
