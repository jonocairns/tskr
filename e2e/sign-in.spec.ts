import { expect, test } from "@playwright/test";

import { createHousehold } from "./support/db";
import { USERS } from "./support/env";
import { signInWithEmail } from "./support/signIn";

test.use({ storageState: { cookies: [], origins: [] } });

test("signs in with email and password and lands on the household dashboard", async ({ page }) => {
	const { householdId } = await createHousehold([{ user: "signIn", role: "DICTATOR" }]);

	await signInWithEmail(page, USERS.signIn.email);

	await expect(page).toHaveURL(new RegExp(`/${householdId}$`));
	await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
});
