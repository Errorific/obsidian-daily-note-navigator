// Step an anchor by one period in either direction. Used by the previous /
// next command palette commands. Pure: no I/O, no Obsidian imports.
//
// The result is always at local noon to match the convention used by parseRef
// and the resolver. For daily/weekly the step is in days; for quarterly the
// step is in months (preserving day-of-month); for yearly the step is in
// years (preserving month + day). Each preserves the property that the new
// anchor resolved by resolve() lands in the adjacent period.

import type { Period } from "./resolver";

export type Direction = 1 | -1;

export function stepAnchor(
	anchor: Date,
	period: Period,
	direction: Direction,
): Date {
	const year = anchor.getFullYear();
	const month = anchor.getMonth();
	const day = anchor.getDate();
	switch (period) {
		case "daily":
			return atLocalNoon(year, month, day + direction);
		case "weekly":
			return atLocalNoon(year, month, day + direction * 7);
		case "quarterly":
			return atLocalNoon(year, month + direction * 3, day);
		case "yearly":
			return atLocalNoon(year + direction, month, day);
		default: {
			const exhaustive: never = period;
			throw new Error(`Unknown period: ${String(exhaustive)}`);
		}
	}
}

function atLocalNoon(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}
