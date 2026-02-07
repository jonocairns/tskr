const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const sourceRoot = path.join(process.cwd(), "src");
const includeExtensions = new Set([".ts", ".tsx"]);
const ignoredDirectories = new Set(["node_modules", ".next", "dist", "build"]);
const useTranslationModules = new Set(["@/lib/i18nClient", "react-i18next"]);
const i18nInstanceModules = new Set(["@/lib/i18n", "i18next"]);

const collectSourceFiles = (directory) => {
	const entries = fs.readdirSync(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (ignoredDirectories.has(entry.name)) {
			continue;
		}

		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectSourceFiles(absolutePath));
			continue;
		}

		const extension = path.extname(entry.name);
		if (!includeExtensions.has(extension) || entry.name.endsWith(".d.ts")) {
			continue;
		}

		files.push(absolutePath);
	}

	return files;
};

const unwrapExpression = (expression) => {
	let current = expression;
	while (true) {
		if (ts.isParenthesizedExpression(current)) {
			current = current.expression;
			continue;
		}
		if (ts.isAsExpression(current)) {
			current = current.expression;
			continue;
		}
		if (ts.isTypeAssertionExpression(current)) {
			current = current.expression;
			continue;
		}
		if (ts.isSatisfiesExpression(current)) {
			current = current.expression;
			continue;
		}
		if (ts.isNonNullExpression(current)) {
			current = current.expression;
			continue;
		}
		return current;
	}
};

const getPropertyAccessInfo = (expression) => {
	const unwrapped = unwrapExpression(expression);
	if (
		unwrapped.kind !== ts.SyntaxKind.PropertyAccessExpression &&
		unwrapped.kind !== ts.SyntaxKind.PropertyAccessChain
	) {
		return null;
	}

	if (!ts.isIdentifier(unwrapped.expression) || !ts.isIdentifier(unwrapped.name)) {
		return null;
	}

	return {
		objectName: unwrapped.expression.text,
		propertyName: unwrapped.name.text,
	};
};

const getImportMetadata = (sourceFile) => {
	const useTranslationIdentifiers = new Set();
	const useTranslationNamespaceIdentifiers = new Set();
	const i18nIdentifiers = new Set();
	const i18nNamespaceIdentifiers = new Set();

	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
			continue;
		}

		const moduleName = statement.moduleSpecifier.text;
		const importClause = statement.importClause;
		if (!importClause) {
			continue;
		}

		if (useTranslationModules.has(moduleName)) {
			if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
				for (const specifier of importClause.namedBindings.elements) {
					const importedName = (specifier.propertyName ?? specifier.name).text;
					if (importedName === "useTranslation") {
						useTranslationIdentifiers.add(specifier.name.text);
					}
				}
			}

			if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
				useTranslationNamespaceIdentifiers.add(importClause.namedBindings.name.text);
			}
		}

		if (i18nInstanceModules.has(moduleName)) {
			if (importClause.name) {
				i18nIdentifiers.add(importClause.name.text);
			}

			if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
				for (const specifier of importClause.namedBindings.elements) {
					const importedName = (specifier.propertyName ?? specifier.name).text;
					if (importedName === "i18n" || importedName === "i18next") {
						i18nIdentifiers.add(specifier.name.text);
					}
				}
			}

			if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
				i18nNamespaceIdentifiers.add(importClause.namedBindings.name.text);
			}
		}
	}

	return {
		useTranslationIdentifiers,
		useTranslationNamespaceIdentifiers,
		i18nIdentifiers,
		i18nNamespaceIdentifiers,
	};
};

const isUseTranslationCall = (expression, useTranslationIdentifiers, useTranslationNamespaceIdentifiers) => {
	const unwrapped = unwrapExpression(expression);
	if (!ts.isCallExpression(unwrapped)) {
		return false;
	}

	const callee = unwrapExpression(unwrapped.expression);
	if (ts.isIdentifier(callee)) {
		return useTranslationIdentifiers.has(callee.text);
	}

	const propertyAccess = getPropertyAccessInfo(callee);
	if (!propertyAccess) {
		return false;
	}

	return (
		propertyAccess.propertyName === "useTranslation" &&
		useTranslationNamespaceIdentifiers.has(propertyAccess.objectName)
	);
};

const isStaticTranslationKey = (expression) => {
	const unwrapped = unwrapExpression(expression);
	return ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped);
};

const formatSnippet = (sourceText, start, end) => {
	const raw = sourceText.slice(start, end).replace(/\s+/g, " ").trim();
	return raw.length <= 120 ? raw : `${raw.slice(0, 117)}...`;
};

const getScriptKind = (filePath) => {
	const extension = path.extname(filePath).toLowerCase();
	if (extension === ".tsx") {
		return ts.ScriptKind.TSX;
	}
	return ts.ScriptKind.TS;
};

const findDynamicTranslationKeysInSource = (sourceText, filePath = "inline.ts") => {
	const scriptKind = getScriptKind(filePath);
	const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
	const importMetadata = getImportMetadata(sourceFile);
	const translationFunctionIdentifiers = new Set();
	const translationObjectIdentifiers = new Set();
	const violations = [];

	const visit = (node) => {
		if (ts.isVariableDeclaration(node) && node.initializer) {
			const isTranslationBinding = isUseTranslationCall(
				node.initializer,
				importMetadata.useTranslationIdentifiers,
				importMetadata.useTranslationNamespaceIdentifiers,
			);

			if (isTranslationBinding) {
				if (ts.isObjectBindingPattern(node.name)) {
					for (const element of node.name.elements) {
						const bindingName = ts.isIdentifier(element.name) ? element.name.text : null;
						if (!bindingName) {
							continue;
						}

						const propertyName = element.propertyName
							? ts.isIdentifier(element.propertyName)
								? element.propertyName.text
								: null
							: bindingName;
						if (propertyName === "t") {
							translationFunctionIdentifiers.add(bindingName);
						}
					}
				}

				if (ts.isIdentifier(node.name)) {
					translationObjectIdentifiers.add(node.name.text);
				}
			}
		}

		if (!ts.isCallExpression(node) || node.arguments.length === 0) {
			ts.forEachChild(node, visit);
			return;
		}

		const callee = unwrapExpression(node.expression);
		let isTranslationCall = false;
		if (ts.isIdentifier(callee) && translationFunctionIdentifiers.has(callee.text)) {
			isTranslationCall = true;
		} else {
			const propertyAccess = getPropertyAccessInfo(callee);
			if (propertyAccess && propertyAccess.propertyName === "t") {
				isTranslationCall =
					translationObjectIdentifiers.has(propertyAccess.objectName) ||
					importMetadata.i18nIdentifiers.has(propertyAccess.objectName) ||
					importMetadata.i18nNamespaceIdentifiers.has(propertyAccess.objectName);
			}
		}

		if (isTranslationCall) {
			const keyArgument = node.arguments[0];
			if (!isStaticTranslationKey(keyArgument)) {
				const position = sourceFile.getLineAndCharacterOfPosition(keyArgument.getStart(sourceFile));
				violations.push({
					filePath,
					line: position.line + 1,
					column: position.character + 1,
					snippet: formatSnippet(sourceText, keyArgument.getStart(sourceFile), keyArgument.getEnd()),
				});
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return violations;
};

const findDynamicTranslationKeys = (filePath) => {
	const sourceText = fs.readFileSync(filePath, "utf8");
	return findDynamicTranslationKeysInSource(sourceText, filePath);
};

const runStaticKeyCheck = (rootDirectory = sourceRoot) => {
	if (!fs.existsSync(rootDirectory)) {
		throw new Error(`[i18n] Source directory not found: ${rootDirectory}`);
	}

	const sourceFiles = collectSourceFiles(rootDirectory);
	const violations = sourceFiles.flatMap(findDynamicTranslationKeys);
	return { sourceFiles, violations };
};

const runCli = () => {
	try {
		const { sourceFiles, violations } = runStaticKeyCheck();
		if (violations.length > 0) {
			console.error("[i18n] Dynamic translation keys are not allowed.");
			console.error("[i18n] Use string literal keys in t(...) and i18n.t(...).");
			for (const violation of violations) {
				const relativePath = path.relative(process.cwd(), violation.filePath);
				console.error(` - ${relativePath}:${violation.line}:${violation.column} -> ${violation.snippet}`);
			}
			process.exit(1);
		}

		console.log(`[i18n] Checked ${sourceFiles.length} files. No dynamic translation keys found.`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
};

if (require.main === module) {
	runCli();
}

module.exports = {
	findDynamicTranslationKeys,
	findDynamicTranslationKeysInSource,
	runStaticKeyCheck,
};
