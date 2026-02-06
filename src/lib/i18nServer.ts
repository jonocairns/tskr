import "server-only";

import i18next, { type i18n as I18n } from "i18next";
import Pseudo from "i18next-pseudo";
import resourcesToBackend from "i18next-resources-to-backend";
import {
	DEFAULT_LANGUAGE,
	getI18nBaseOptions,
	normalizeLanguage,
	PSEUDO_ENABLED,
	PSEUDO_LANGUAGE,
} from "@/lib/i18nConfig";

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
	const pseudo = new Pseudo({ enabled: PSEUDO_ENABLED, languageToPseudo: PSEUDO_LANGUAGE });

	await instance
		.use(pseudo)
		.use(backend)
		.init({ ...getI18nBaseOptions(PSEUDO_ENABLED), lng });

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
