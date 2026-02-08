type Violation = {
	filePath: string;
	line: number;
	column: number;
	snippet: string;
};

const { findDynamicTranslationKeysInSource } = require("../scripts/i18n-check-static-keys.cjs") as {
	findDynamicTranslationKeysInSource: (sourceText: string, filePath?: string) => Violation[];
};

const check = (sourceText: string, filePath = "virtual.tsx") => {
	return findDynamicTranslationKeysInSource(sourceText, filePath);
};

test("allows static keys from useTranslation", () => {
	const source = `
		import { useTranslation } from "@/lib/i18nClient";

		const Component = () => {
			const { t } = useTranslation();
			return t("Save");
		};
	`;

	expect(check(source)).toHaveLength(0);
});

test("flags dynamic keys from useTranslation", () => {
	const source = `
		import { useTranslation } from "@/lib/i18nClient";

		const Component = () => {
			const { t } = useTranslation();
			const key = "Save";
			return t(key);
		};
	`;

	const violations = check(source);
	expect(violations).toHaveLength(1);
	expect(violations[0]?.snippet).toBe("key");
});

test("ignores non-i18n functions named t", () => {
	const source = `
		const t = (value: string) => value.toUpperCase();
		const value = "save";
		t(value);
	`;

	expect(check(source, "utility.ts")).toHaveLength(0);
});

test("flags dynamic keys when t is aliased from useTranslation", () => {
	const source = `
		import { useTranslation } from "react-i18next";

		const Component = () => {
			const { t: tr } = useTranslation();
			const key = "Save";
			return tr(key);
		};
	`;

	const violations = check(source);
	expect(violations).toHaveLength(1);
	expect(violations[0]?.snippet).toBe("key");
});

test("flags dynamic keys when calling t on useTranslation result object", () => {
	const source = `
		import { useTranslation } from "@/lib/i18nClient";

		const Component = () => {
			const i18nApi = useTranslation();
			const key = "Save";
			return i18nApi.t(key);
		};
	`;

	const violations = check(source);
	expect(violations).toHaveLength(1);
	expect(violations[0]?.snippet).toBe("key");
});

test("handles namespace import useTranslation and flags dynamic keys", () => {
	const source = `
		import * as ReactI18next from "react-i18next";

		const Component = () => {
			const { t } = ReactI18next.useTranslation();
			const key = "Save";
			return t(key);
		};
	`;

	const violations = check(source);
	expect(violations).toHaveLength(1);
	expect(violations[0]?.snippet).toBe("key");
});

test("checks i18n instance calls and allows only static keys", () => {
	const dynamicSource = `
		import i18n from "@/lib/i18n";
		const key = "Pseudo (dev)";
		i18n.t(key);
	`;
	const staticSource = `
		import i18n from "@/lib/i18n";
		i18n.t("Pseudo (dev)");
	`;

	expect(check(dynamicSource, "instance.ts")).toHaveLength(1);
	expect(check(staticSource, "instance.ts")).toHaveLength(0);
});
