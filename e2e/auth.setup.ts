import { expect, test as setup } from "@playwright/test";

import { AUTH_STATE, USERS } from "./support/env";
import { signInWithEmail } from "./support/signIn";

for (const user of ["member", "approver"] as const) {
	setup(`sign in as ${user}`, async ({ page }) => {
		await signInWithEmail(page, USERS[user].email);
		// Accounts start without a household, so a signed-in session lands on /landing.
		await expect(page).toHaveURL(/\/landing$/);
		await page.context().storageState({ path: AUTH_STATE[user] });
	});
}
