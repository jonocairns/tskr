module.exports = {
	testEnvironment: "node",
	testMatch: ["<rootDir>/tests/**/*.test.ts"],
	transform: {
		"^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: { module: "CommonJS" } }],
	},
};
