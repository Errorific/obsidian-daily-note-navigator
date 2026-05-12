// Duck-type guards for narrowing TAbstractFile to TFile or TFolder.
//
// The obsidian npm package ships types only -- there are no runtime classes
// to `instanceof` against in vitest. Both real Obsidian objects and the
// FakeVault test helpers expose the distinguishing properties used here.

import type { TAbstractFile, TFile, TFolder } from "obsidian";

export function isFile(file: TAbstractFile): file is TFile {
	return "extension" in file;
}

export function isFolder(file: TAbstractFile): file is TFolder {
	return "children" in file;
}
