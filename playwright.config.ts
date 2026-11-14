import { defineConfig, devices } from "@playwright/test";

import { BASE_URL, DATABASE_URL, DB_DIR, PORT } from "./e2e/support/env";

const isCI = !!process.env.CI;
// Set E2E_SKIP_BUILD=1 to reuse an existing production build in .next.
const skipBuild = process.env.E2E_SKIP_BUILD === "1";

// The server owns the database lifecycle: recreate and migrate before starting,
// because Playwright starts the web server before global setup runs.
const serverCommand = [
	...(skipBuild ? [] : ["pnpm build"]),
	`rm -rf "${DB_DIR}"`,
	`mkdir -p "${DB_DIR}"`,
	"pnpm exec prisma migrate deploy",
	`pnpm start -p ${PORT} -H 127.0.0.1`,
].join(" && ");

export default defineConfig({
	testDir: "./e2e",
	// One SQLite file and a shared server: run serially.
	fullyParallel: false,
	workers: 1,
	retries: isCI ? 1 : 0,
	forbidOnly: isCI,
	timeout: 30_000,
	expect: { timeout: 10_000 },
	reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["list"]],
	globalSetup: "./e2e/global-setup.ts",
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{ name: "setup", testMatch: /auth\.setup\.ts/ },
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
			dependencies: ["setup"],
			testIgnore: /auth\.setup\.ts/,
		},
	],
	webServer: {
		command: serverCommand,
		// Health route has no auth or database dependencies.
		url: `${BASE_URL}/api/health`,
		reuseExistingServer: false,
		timeout: 300_000,
		stdout: "ignore",
		stderr: "pipe",
		env: {
			DATABASE_URL,
			NEXTAUTH_URL: BASE_URL,
			NEXTAUTH_SECRET: "e2e-not-a-secret",
			PRISMA_HIDE_UPDATE_MESSAGE: "1",
		},
	},
});
