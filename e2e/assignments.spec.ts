import { expect, test } from "@playwright/test";
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

test.describe("as an approver", () => {
	test.use({ storageState: AUTH_STATE.approver });

	test("creates and assigns a new household task from the assignment form", async ({ page }) => {
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

		// Reach the form from the dashboard board, after hydration.
		await openDashboard(page, householdId);
		await page.getByRole("link", { name: "Add task" }).click();
		await expect(page).toHaveURL(new RegExp(`/${householdId}/assignments$`));

		await page.getByRole("combobox", { name: "Task" }).click();
		await page.getByRole("option", { name: "New task…" }).click();
		await page.getByLabel("Task name").fill("Water the plants");
		await page.getByRole("button", { name: "Add task" }).click();

		await expect(page.getByText("Task added").first()).toBeVisible();
		await expect(page.getByRole("combobox", { name: "Task" })).toHaveText("Water the plants");

		// The new task is on the approver's own board, ready to complete.
		await openDashboard(page, householdId);
		await expect(page.getByRole("button", { name: "Complete Water the plants" })).toBeVisible();
	});
});
