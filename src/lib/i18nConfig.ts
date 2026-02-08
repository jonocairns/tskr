import supportedLanguages from "@/locales/supported.json";

export const DEFAULT_LANGUAGE = "en";
export const PSEUDO_LANGUAGE = "pseudo";
export const SUPPORTED_NAMESPACES = ["translation"] as const;
export const PSEUDO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PSEUDO === "true" || process.env.NODE_ENV !== "production";

export const normalizeLanguage = (value: string) => value.trim().toLowerCase();

const toCanonicalLanguage = (value: string) => {
	const normalized = normalizeLanguage(value);
	if (normalized === PSEUDO_LANGUAGE) {
		return normalized;
	}
	try {
		const [canonical] = Intl.getCanonicalLocales(normalized);
		return canonical ?? normalized;
	} catch {
		return normalized;
	}
};

const getDisplayNamesForLocale = (locale: string) => {
	const normalizedLocale = normalizeLanguage(locale);
	const fallbackLocale = normalizedLocale === PSEUDO_LANGUAGE ? DEFAULT_LANGUAGE : normalizedLocale;
	try {
		return new Intl.DisplayNames([toCanonicalLanguage(fallbackLocale)], { type: "language" });
	} catch {
		return null;
	}
};

export const getLanguageLabel = (value: string, options?: { locale?: string; pseudoLabel?: string }) => {
	const normalizedLanguage = normalizeLanguage(value);
	if (normalizedLanguage === PSEUDO_LANGUAGE) {
		return options?.pseudoLabel ?? "Pseudo (dev)";
	}

	const displayNames = getDisplayNamesForLocale(options?.locale ?? DEFAULT_LANGUAGE);
	const canonicalLanguage = toCanonicalLanguage(normalizedLanguage);
	const label = displayNames?.of(canonicalLanguage);
	return label && label.trim().length > 0 ? label : canonicalLanguage;
};

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
