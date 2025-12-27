module.exports = {
	testEnvironment: "node",
	testMatch: ["<rootDir>/tests/**/*.test.ts"],
	transform: {
		"^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: { module: "CommonJS" } }],
	},
	moduleNameMapper: {
		"^server-only$": "<rootDir>/tests/__mocks__/server-only.ts",
	},
};
