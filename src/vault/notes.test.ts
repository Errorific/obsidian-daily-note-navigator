import { describe, expect, it } from "vitest";
import { resolve } from "../dates/resolver";
import { makeApp } from "./fakes";
import { createEmpty, ensureFolder, exists } from "./notes";

function localDate(year: number, monthIndex: number, day: number): Date {
	return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

describe("exists", () => {
	it("returns false when the path is not in the vault", () => {
		const { app } = makeApp();
		const resolved = resolve(localDate(2026, 4, 11), "daily");
		expect(exists(app, resolved)).toBe(false);
	});

	it("returns true when the path exists as a file", () => {
		const { app, vault } = makeApp();
		const resolved = resolve(localDate(2026, 4, 11), "daily");
		vault.files.set(resolved.path, "existing content");
		expect(exists(app, resolved)).toBe(true);
	});

	it("returns false when a folder occupies the resolved note path", () => {
		// Implausible in normal use, but the contract is "does the note exist",
		// not "is anything at this path". A folder collision must not be
		// reported as an existing note.
		const { app, vault } = makeApp();
		const resolved = resolve(localDate(2026, 4, 11), "daily");
		vault.folders.add(resolved.path);
		expect(exists(app, resolved)).toBe(false);
	});
});

describe("ensureFolder", () => {
	it("returns the existing folder when it is already present", async () => {
		const { app, vault } = makeApp();
		vault.folders.add("Journal/2026");
		const folder = await ensureFolder(app, "Journal/2026");
		expect(folder.path).toBe("Journal/2026");
		// No new folders should have been created.
		expect(vault.folders.size).toBe(1);
	});

	it("creates a missing folder, recursively including parents", async () => {
		const { app, vault } = makeApp();
		const folder = await ensureFolder(app, "Journal/2026/Q2/W20");
		expect(folder.path).toBe("Journal/2026/Q2/W20");
		expect(vault.folders.has("Journal")).toBe(true);
		expect(vault.folders.has("Journal/2026")).toBe(true);
		expect(vault.folders.has("Journal/2026/Q2")).toBe(true);
		expect(vault.folders.has("Journal/2026/Q2/W20")).toBe(true);
	});

	it("is idempotent: calling twice does not error or double-create", async () => {
		const { app, vault } = makeApp();
		await ensureFolder(app, "Journal/2026/Q2/W20");
		const sizeAfterFirst = vault.folders.size;
		await ensureFolder(app, "Journal/2026/Q2/W20");
		expect(vault.folders.size).toBe(sizeAfterFirst);
	});

	it("throws when the path exists as a file, not a folder", async () => {
		const { app, vault } = makeApp();
		vault.files.set("Journal/note.md", "");
		await expect(ensureFolder(app, "Journal/note.md")).rejects.toThrow(
			"path exists and is not a folder",
		);
	});
});

describe("createEmpty", () => {
	it("creates an empty file at the resolved path", async () => {
		const { app, vault } = makeApp();
		const resolved = resolve(localDate(2026, 4, 11), "daily");
		const file = await createEmpty(app, resolved.path);
		expect(file.path).toBe(resolved.path);
		expect(vault.files.get(resolved.path)).toBe("");
	});

	it("creates the parent folder chain if it does not exist", async () => {
		const { app, vault } = makeApp();
		const resolved = resolve(localDate(2026, 4, 11), "daily");
		await createEmpty(app, resolved.path);
		expect(vault.folders.has(resolved.folder)).toBe(true);
		expect(vault.folders.has("Journal/2026")).toBe(true);
	});

	it("throws when a file already exists at the path", async () => {
		const { app, vault } = makeApp();
		vault.folders.add("Journal");
		vault.files.set("Journal/note.md", "existing");
		await expect(createEmpty(app, "Journal/note.md")).rejects.toThrow(
			"Path already exists",
		);
		// Content must be untouched.
		expect(vault.files.get("Journal/note.md")).toBe("existing");
	});

	it("creates a file at the vault root with no parent folder", async () => {
		const { app, vault } = makeApp();
		const file = await createEmpty(app, "root-note.md");
		expect(file.path).toBe("root-note.md");
		expect(vault.files.has("root-note.md")).toBe(true);
	});
});
