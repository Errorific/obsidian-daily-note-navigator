export interface TemplateSettings {
	daily?: string;
	weekly?: string;
	quarterly?: string;
	yearly?: string;
}

export interface Settings {
	templates: TemplateSettings;
}

export const DEFAULT_SETTINGS: Settings = {
	templates: {},
};
