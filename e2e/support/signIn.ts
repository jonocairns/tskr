import type { Page } from "@playwright/test";

import { PASSWORD } from "./env";

export const signInWithEmail = async (page: Page, email: string) => {
	await page.goto("/");
	await page.locator("#email-login").fill(email);
	await page.locator("#password-login").fill(PASSWORD);
	await page.getByRole("button", { name: "Sign in with email" }).click();
};
