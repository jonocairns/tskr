import { expect, type Page } from "@playwright/test";

// Server-rendered controls are visible before React attaches their handlers, and
// a click in that window is silently lost. The dashboard opens its live-refresh
// stream from an effect, so that request means the page has hydrated.
const waitForHydration = (page: Page) =>
	page.waitForRequest((request) => new URL(request.url()).pathname === "/api/stream");

export const openDashboard = async (page: Page, householdId: string) => {
	await Promise.all([waitForHydration(page), page.goto(`/${householdId}`)]);
};

export const reloadDashboard = async (page: Page) => {
	await Promise.all([waitForHydration(page), page.reload()]);
};

export const balance = (page: Page) => page.getByRole("region", { name: "Current balance" });

export const history = (page: Page) => page.getByRole("region", { name: "History" });

export const expectBalance = async (page: Page, points: number) => {
	await expect(balance(page).getByText(`${points} pts`, { exact: true })).toBeVisible();
};

// Preset tiles are role="button" with the label, points and bucket as their name.
export const taskTile = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^${label}\\b`) });
