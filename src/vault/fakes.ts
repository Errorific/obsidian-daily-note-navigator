// Lightweight Vault / App stand-ins for unit testing the vault wrappers.
// Only the four methods we actually call are implemented (getAbstractFileByPath,
// create, createFolder, read). Returned objects carry just enough shape for
// the production duck-type checks (TFile has `extension`, TFolder has
// `children`).
//
// Tests seed state by poking the public `files` Map and `folders` Set
// directly. There's no `seed()` helper; the call sites are short enough
// without it.

import type {
	App,
	TAbstractFile,
	TFile,
	TFolder,
	Vault,
	Workspace,
} from "obsidian";

export class FakeVault {
	readonly files = new Map<string, string>();
	readonly folders = new Set<string>();

	getAbstractFileByPath(path: string): TAbstractFile | null {
		if (this.folders.has(path)) {
			return makeFolder(path);
		}
		if (this.files.has(path)) {
			return makeFile(path);
		}
		return null;
	}

	async create(path: string, data: string): Promise<TFile> {
		const parent = parentOf(path);
		if (parent !== "" && !this.folders.has(parent)) {
			throw new Error(`Folder does not exist: ${parent}`);
		}
		if (this.files.has(path) || this.folders.has(path)) {
			throw new Error(`Path already exists: ${path}`);
		}
		this.files.set(path, data);
		return makeFile(path);
	}

	async createFolder(path: string): Promise<TFolder> {
		if (this.folders.has(path) || this.files.has(path)) {
			throw new Error(`Path already exists: ${path}`);
		}
		const parts = path.split("/");
		let current = "";
		for (const part of parts) {
			current = current === "" ? part : `${current}/${part}`;
			if (this.files.has(current)) {
				throw new Error(`Path is a file, not a folder: ${current}`);
			}
			this.folders.add(current);
		}
		return makeFolder(path);
	}

	async read(file: TFile): Promise<string> {
		const content = this.files.get(file.path);
		if (content === undefined) {
			throw new Error(`File not found: ${file.path}`);
		}
		return content;
	}

	async modify(file: TFile, data: string): Promise<void> {
		if (!this.files.has(file.path)) {
			throw new Error(`File not found: ${file.path}`);
		}
		this.files.set(file.path, data);
	}

	async delete(file: TAbstractFile): Promise<void> {
		if (this.files.has(file.path)) {
			this.files.delete(file.path);
			return;
		}
		if (this.folders.has(file.path)) {
			this.folders.delete(file.path);
			return;
		}
		throw new Error(`File not found: ${file.path}`);
	}
}

export interface FakeOpen {
	path: string;
	tab: boolean;
}

export class FakeWorkspace {
	readonly opens: FakeOpen[] = [];

	getLeaf(newLeaf: boolean | string = false): {
		openFile: (file: TFile) => Promise<void>;
	} {
		const tab = newLeaf === true || newLeaf === "tab";
		return {
			openFile: async (file: TFile) => {
				this.opens.push({ path: file.path, tab });
			},
		};
	}
}

export function makeApp(): {
	app: App;
	vault: FakeVault;
	workspace: FakeWorkspace;
} {
	const vault = new FakeVault();
	const workspace = new FakeWorkspace();
	const app = {
		vault: vault as unknown as Vault,
		workspace: workspace as unknown as Workspace,
	} as App;
	return { app, vault, workspace };
}

function parentOf(path: string): string {
	const slash = path.lastIndexOf("/");
	return slash > 0 ? path.slice(0, slash) : "";
}

function makeFile(path: string): TFile {
	const slash = path.lastIndexOf("/");
	const name = slash >= 0 ? path.slice(slash + 1) : path;
	const dot = name.lastIndexOf(".");
	const basename = dot > 0 ? name.slice(0, dot) : name;
	const extension = dot > 0 ? name.slice(dot + 1) : "";
	return { path, name, basename, extension } as TFile;
}

function makeFolder(path: string): TFolder {
	const slash = path.lastIndexOf("/");
	const name = slash >= 0 ? path.slice(slash + 1) : path;
	return { path, name, children: [] } as unknown as TFolder;
}
