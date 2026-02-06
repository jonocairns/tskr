import supportedLanguages from "@/locales/supported.json";

export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_NAMESPACES = ["translation", "errors"] as const;

export const normalizeLanguage = (value: string) => value.trim().toLowerCase();

const normalizedSupported = supportedLanguages.map(normalizeLanguage);
export const SUPPORTED_LANGUAGES = Array.from(new Set(normalizedSupported)).sort((a, b) => a.localeCompare(b));

export const isSupportedLanguage = (value: string) => SUPPORTED_LANGUAGES.includes(normalizeLanguage(value));
