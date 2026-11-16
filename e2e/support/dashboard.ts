import { expect, type Page, type Request } from "@playwright/test";

// Server-rendered controls are visible before React attaches their handlers, and
// a click in that window is silently lost. The dashboard opens its live-refresh
// stream from an effect, so that request means the page has hydrated.
const waitForHydration = (page: Page) =>
	page.waitForRequest((request) => new URL(request.url()).pathname === "/api/stream");

export const openDashboard = async (page: Page, householdId: string) => {
	await Promise.all([waitForHydration(page), page.goto(`/${householdId}`)]);
};

export const openTasks = async (page: Page, householdId: string, query = "userId=all", route = "tasks") => {
	let streamOpened = false;
	const onRequest = (request: Request) => {
		if (new URL(request.url()).pathname === "/api/stream") streamOpened = true;
	};
	page.on("request", onRequest);
	try {
		await page.goto(`/${householdId}/${route}?${query}`);
		// Manage disables live refresh. Its creation controls enable after hydration.
		if (
			await page
				.locator('a[aria-current="page"]')
				.filter({ hasText: /^Manage$/ })
				.count()
		) {
			await expect(page.getByRole("button", { name: "Add task", exact: true })).toBeEnabled();
		} else {
			await expect.poll(() => streamOpened).toBe(true);
		}
	} finally {
		page.off("request", onRequest);
	}
};

export const reloadDashboard = async (page: Page) => {
	await Promise.all([waitForHydration(page), page.reload()]);
};

export const balance = (page: Page) => page.getByRole("region", { name: "Current balance" });

export const history = (page: Page) => page.getByRole("region", { name: "History" });

export const expectBalance = async (page: Page, points: number) => {
	await expect(balance(page).getByText(`${points} pts`, { exact: true })).toBeVisible();
};

// Quick log tiles are role="button" with the label, points and bucket as their name.
export const taskTile = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^${label}\\b`) });
