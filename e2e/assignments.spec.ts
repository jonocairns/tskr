import { test } from "@playwright/test";
import { expectBalance, openDashboard } from "./support/dashboard";
import { createAssignment, createHousehold, createPreset } from "./support/db";
import { AUTH_STATE } from "./support/env";

test.use({ storageState: AUTH_STATE.member });

// Deliberately minimal: the assignment UI is being reworked, so this only relies
// on the "Complete <task>" button and the resulting balance.
test("completes an assigned task from the dashboard", async ({ page }) => {
	const { householdId, userIds } = await createHousehold([
		{ user: "approver", role: "APPROVER" },
		{ user: "member", role: "DOER" },
	]);
	const { presetId } = await createPreset({
		householdId,
		createdById: userIds.approver,
		label: "Feed the cat",
		bucket: "QUICK",
	});
	await createAssignment({ householdId, presetId, assignedToId: userIds.member, assignedById: userIds.approver });

	await openDashboard(page, householdId);
	await expectBalance(page, 0);

	await page.getByRole("button", { name: "Complete Feed the cat" }).click();

	await expectBalance(page, 3);
});
