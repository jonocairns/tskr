const fs = require("fs");
const path = require("path");

const localesRoot = path.join(process.cwd(), "src", "locales");
const outputPath = path.join(localesRoot, "supported.json");

const hasLocaleFiles = (dir) => {
	const translationPath = path.join(localesRoot, dir, "translation.json");
	const errorsPath = path.join(localesRoot, dir, "errors.json");
	return fs.existsSync(translationPath) && fs.existsSync(errorsPath);
};

const buildSupportedLanguages = () => {
	if (!fs.existsSync(localesRoot)) {
		return [];
	}

	const entries = fs.readdirSync(localesRoot, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((name) => hasLocaleFiles(name))
		.sort((a, b) => a.localeCompare(b));
};

const supported = buildSupportedLanguages();

fs.mkdirSync(localesRoot, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(supported, null, "\t")}\n`, "utf8");

if (supported.some((name) => name !== name.toLowerCase())) {
	const nonLowercase = supported.filter((name) => name !== name.toLowerCase());
	console.warn(`[i18n] Warning: locale folders should be lowercase. Found: ${nonLowercase.join(", ")}`);
}

console.log(`[i18n] Wrote ${supported.length} supported language(s) to ${outputPath}`);
