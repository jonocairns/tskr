import { expect, test } from "@playwright/test";
import { expectBalance, history, openDashboard, taskTile } from "./support/dashboard";
import { createApprovedLog, createHousehold, createPreset } from "./support/db";
import { AUTH_STATE } from "./support/env";

test.use({ storageState: AUTH_STATE.member });

test("logs a preset task from the Tasks grid", async ({ page }) => {
	const { householdId, userIds } = await createHousehold([{ user: "member", role: "DICTATOR" }]);
	await createPreset({ householdId, createdById: userIds.member, label: "Water the plants", bucket: "ROUTINE" });

	await openDashboard(page, householdId);
	await expectBalance(page, 0);

	await taskTile(page, "Water the plants").click();

	await expect(history(page).getByRole("row", { name: /Water the plants/ })).toContainText("+6");
	await expectBalance(page, 6);
});

test("undoes a logged task", async ({ page }) => {
	const { householdId, userIds } = await createHousehold([{ user: "member", role: "DICTATOR" }]);
	await createApprovedLog({ householdId, userId: userIds.member, description: "Take out the bins", bucket: "QUICK" });

	await openDashboard(page, householdId);
	await expectBalance(page, 3);

	const row = history(page).getByRole("row", { name: /Take out the bins/ });
	await row.getByRole("button", { name: "Undo" }).click();

	await expect(row).toContainText("Reverted");
	await expectBalance(page, 0);
});

test("claims a reward once the balance reaches the threshold", async ({ page }) => {
	const { householdId, userIds } = await createHousehold([{ user: "member", role: "DICTATOR" }]);
	// The default household threshold is 50 points.
	await createApprovedLog({
		householdId,
		userId: userIds.member,
		description: "Spring clean",
		bucket: "MAJOR",
		points: 50,
	});

	await openDashboard(page, householdId);
	await expectBalance(page, 50);

	await page.getByRole("button", { name: "Claim reward" }).click();

	await expect(history(page).getByRole("row", { name: /Reward claimed/ })).toContainText("-50");
	await expectBalance(page, 0);
	await expect(page.getByRole("button", { name: "Keep earning" })).toBeDisabled();
});
