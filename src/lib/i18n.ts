import i18n from "i18next";
import Pseudo from "i18next-pseudo";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";

import { getI18nBaseOptions, PSEUDO_ENABLED, PSEUDO_LANGUAGE } from "@/lib/i18nConfig";

const backend = resourcesToBackend((language: string, namespace: string) =>
	import(`@/locales/${language}/${namespace}.json`).then((module) => module.default).catch(() => ({})),
);

const defaultOptions = {
	...getI18nBaseOptions(PSEUDO_ENABLED),
	react: { useSuspense: false },
};

if (!i18n.isInitialized) {
	const pseudo = new Pseudo({ enabled: PSEUDO_ENABLED, languageToPseudo: PSEUDO_LANGUAGE });
	i18n.use(pseudo).use(initReactI18next).use(backend).init(defaultOptions);
}

export default i18n;
