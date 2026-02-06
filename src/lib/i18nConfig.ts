import supportedLanguages from "@/locales/supported.json";

export const DEFAULT_LANGUAGE = "en";
export const PSEUDO_LANGUAGE = "pseudo";
export const SUPPORTED_NAMESPACES = ["translation", "errors"] as const;

export const normalizeLanguage = (value: string) => value.trim().toLowerCase();

const normalizedSupported = supportedLanguages.map(normalizeLanguage);
const supportedSet = new Set(normalizedSupported);
if (process.env.NODE_ENV === "development") {
	supportedSet.add(PSEUDO_LANGUAGE);
}
export const SUPPORTED_LANGUAGES = Array.from(supportedSet).sort((a, b) => a.localeCompare(b));

export const isSupportedLanguage = (value: string) => SUPPORTED_LANGUAGES.includes(normalizeLanguage(value));

export const getI18nBaseOptions = (isDev: boolean) => ({
	lng: DEFAULT_LANGUAGE,
	fallbackLng: DEFAULT_LANGUAGE,
	supportedLngs: SUPPORTED_LANGUAGES,
	defaultNS: SUPPORTED_NAMESPACES[0],
	ns: SUPPORTED_NAMESPACES,
	interpolation: { escapeValue: false },
	returnNull: false,
	returnEmptyString: false,
	...(isDev ? { postProcess: ["pseudo"] } : {}),
});
