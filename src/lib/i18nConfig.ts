import supportedLanguages from "@/locales/supported.json";

export const DEFAULT_LANGUAGE = "en";
export const PSEUDO_LANGUAGE = "pseudo";
export const FRENCH = "fr";
export const SPANISH = "es";
export const SUPPORTED_NAMESPACES = ["translation", "errors"] as const;
export const PSEUDO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PSEUDO === "true" || process.env.NODE_ENV !== "production";

export const normalizeLanguage = (value: string) => value.trim().toLowerCase();

export const LANGUAGE_LABELS: Record<string, string> = {
	[DEFAULT_LANGUAGE]: "English",
	[PSEUDO_LANGUAGE]: "Pseudo (dev)",
	[FRENCH]: "French",
	[SPANISH]: "Spanish",
};

export const getLanguageLabel = (value: string) => LANGUAGE_LABELS[normalizeLanguage(value)] ?? value;

const normalizedSupported = supportedLanguages.map(normalizeLanguage);
const supportedSet = new Set(normalizedSupported);
if (PSEUDO_ENABLED) {
	supportedSet.add(PSEUDO_LANGUAGE);
}
export const SUPPORTED_LANGUAGES = Array.from(supportedSet).sort((a, b) => a.localeCompare(b));

export const isSupportedLanguage = (value: string) => SUPPORTED_LANGUAGES.includes(normalizeLanguage(value));

export const getI18nBaseOptions = (pseudoEnabled: boolean) => ({
	lng: DEFAULT_LANGUAGE,
	fallbackLng: DEFAULT_LANGUAGE,
	supportedLngs: SUPPORTED_LANGUAGES,
	defaultNS: SUPPORTED_NAMESPACES[0],
	ns: SUPPORTED_NAMESPACES,
	interpolation: { escapeValue: false },
	returnNull: false,
	returnEmptyString: false,
	...(pseudoEnabled ? { postProcess: ["pseudo"] } : {}),
});
