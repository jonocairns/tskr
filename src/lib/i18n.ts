import i18n from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, SUPPORTED_NAMESPACES } from "@/lib/i18nConfig";

const backend = resourcesToBackend((language: string, namespace: string) =>
	import(`@/locales/${language}/${namespace}.json`)
		.then((module) => module.default)
		.catch(() => ({})),
);

const defaultOptions = {
		lng: DEFAULT_LANGUAGE,
		fallbackLng: DEFAULT_LANGUAGE,
		supportedLngs: SUPPORTED_LANGUAGES,
		defaultNS: SUPPORTED_NAMESPACES[0],
		ns: SUPPORTED_NAMESPACES,
	interpolation: { escapeValue: false },
	react: { useSuspense: false },
	returnNull: false,
	returnEmptyString: false,
};

if (!i18n.isInitialized) {
	i18n.use(initReactI18next).use(backend).init(defaultOptions);
}

export default i18n;
