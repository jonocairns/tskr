const config = {
	input: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
	options: {
		debug: false,
		sort: true,
		func: {
			list: ["t", "i18n.t"],
			extensions: [".ts", ".tsx"],
		},
		trans: false,
		lngs: ["en"],
		ns: ["translation", "errors"],
		defaultLng: "en",
		defaultNs: "translation",
		keySeparator: false,
		nsSeparator: false,
		defaultValue: (_lng, _ns, key) => key,
		resource: {
			loadPath: "src/locales/{{lng}}/{{ns}}.json",
			savePath: "src/locales/{{lng}}/{{ns}}.json",
			jsonIndent: "\t",
			lineEnding: "\n",
		},
	},
};

module.exports = config;
