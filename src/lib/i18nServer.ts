import "server-only";

import i18next, { type i18n as I18n } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { DEFAULT_LANGUAGE, normalizeLanguage, SUPPORTED_LANGUAGES, SUPPORTED_NAMESPACES } from "@/lib/i18nConfig";

const serverInstances = new Map<string, Promise<I18n>>();

const loadResource = async (language: string, namespace: string) => {
	try {
		const module = await import(`@/locales/${language}/${namespace}.json`);
		return module.default as Record<string, string>;
	} catch {
		return null;
	}
};

const backend = resourcesToBackend((language: string, namespace: string) =>
	loadResource(language, namespace).then((resource) => resource ?? {}),
);

const initServerI18n = async (lng: string) => {
	const instance = i18next.createInstance();

	await instance.use(backend).init({
		lng,
		fallbackLng: DEFAULT_LANGUAGE,
		supportedLngs: SUPPORTED_LANGUAGES,
		defaultNS: SUPPORTED_NAMESPACES[0],
		ns: SUPPORTED_NAMESPACES,
		interpolation: { escapeValue: false },
		returnNull: false,
		returnEmptyString: false,
	});

	return instance;
};

export const getServerT = async (lng = DEFAULT_LANGUAGE) => {
	const normalized = normalizeLanguage(lng || DEFAULT_LANGUAGE);
	let instancePromise = serverInstances.get(normalized);
	if (!instancePromise) {
		instancePromise = initServerI18n(normalized);
		serverInstances.set(normalized, instancePromise);
	}
	const instance = await instancePromise;
	return instance.t.bind(instance);
};
