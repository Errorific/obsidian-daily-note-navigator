import { type App, type Plugin, PluginSettingTab, Setting } from "obsidian";
import type { Period } from "../dates/resolver";
import type { Settings } from "../settings";
import { isFile, isFolder } from "../vault/predicates";

export interface PluginWithSettingsIO extends Plugin {
	settings: Settings;
	saveSettings: () => Promise<void>;
}

const FIELDS: ReadonlyArray<{
	period: Period;
	label: string;
	placeholder: string;
}> = [
	{ period: "daily", label: "Daily template", placeholder: "Templates/Daily.md" },
	{ period: "weekly", label: "Weekly template", placeholder: "Templates/Weekly.md" },
	{
		period: "quarterly",
		label: "Quarterly template",
		placeholder: "Templates/Quarterly.md",
	},
	{ period: "yearly", label: "Yearly template", placeholder: "Templates/Yearly.md" },
];

export class SettingsTab extends PluginSettingTab {
	private readonly plugin: PluginWithSettingsIO;

	constructor(app: App, plugin: PluginWithSettingsIO) {
		super(app, plugin);
		this.plugin = plugin;
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Templates").setHeading();
		containerEl.createEl("p", {
			text:
				"Vault-relative paths, e.g. Templates/Daily.md. Leave a field empty to create that period's notes as blank files.",
			cls: "setting-item-description",
		});

		for (const { period, label, placeholder } of FIELDS) {
			const setting = new Setting(containerEl).setName(label);
			const error = setting.descEl.createDiv({ cls: "dnn-settings-path-error" });
			setting.addText((text) => {
				const input = text.inputEl;
				const apply = (value: string) => {
					const status = validatePath(this.plugin, value);
					input.toggleClass("dnn-settings-path-invalid", status !== "ok");
					error.setText(messageFor(status));
				};
				text
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings.templates[period] ?? "")
					.onChange(async (value) => {
						const trimmed = value.trim();
						if (trimmed === "") {
							delete this.plugin.settings.templates[period];
						} else {
							this.plugin.settings.templates[period] = trimmed;
						}
						apply(value);
						await this.plugin.saveSettings();
					});
				apply(input.value);
			});
		}
	}
}

type ValidationStatus = "ok" | "not-found" | "is-folder";

function validatePath(
	plugin: PluginWithSettingsIO,
	value: string,
): ValidationStatus {
	const trimmed = value.trim();
	if (trimmed === "") return "ok";
	const file = plugin.app.vault.getAbstractFileByPath(trimmed);
	if (file === null) return "not-found";
	if (isFolder(file)) return "is-folder";
	if (!isFile(file)) return "not-found";
	return "ok";
}

function messageFor(status: ValidationStatus): string {
	switch (status) {
		case "ok":
			return "";
		case "not-found":
			return "No file at this path.";
		case "is-folder":
			return "Path points to a folder, not a file.";
		default: {
			const exhaustive: never = status;
			throw new Error(`Unknown status: ${String(exhaustive)}`);
		}
	}
}
