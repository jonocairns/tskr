import { expect, test } from "@playwright/test";
import { expectBalance, history, openDashboard, openTasks, taskTile } from "./support/dashboard";
import { createApprovedLog, createAssignment, createHousehold, createPreset, getPrisma } from "./support/db";
import { AUTH_STATE, USERS } from "./support/env";

test.use({ storageState: AUTH_STATE.member });

test("logs a task from the Quick log grid", async ({ page }) => {
	const { householdId, userIds } = await createHousehold([{ user: "member", role: "DICTATOR" }]);
	await createPreset({ householdId, createdById: userIds.member, label: "Water the plants", bucket: "ROUTINE" });

	await openDashboard(page, householdId);
	await expectBalance(page, 0);
	await expect(page.getByText("Quick log", { exact: true })).toBeVisible();
	// New users get an in-page jump to the Quick log card.
	await expect(page.getByRole("link", { name: "Log a task" })).toHaveAttribute("href", "#quick-log");

	await taskTile(page, "Water the plants").click();

	// Undo from the toast before its timer runs out; History has its own Undo button.
	const toastUndo = page.getByRole("region", { name: /Notifications/ }).getByRole("button", { name: "Undo" });
	await expect(toastUndo).toBeVisible();
	await expect(history(page).getByRole("row", { name: /Water the plants/ })).toContainText("+6");
	await toastUndo.click();
	await expect(history(page).getByRole("row", { name: /Water the plants/ })).toContainText("Reverted");
	await expectBalance(page, 0);
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
	await expect(page.getByText("50 pts to your next reward", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Claim reward" })).toHaveCount(0);
});

test("pauses claiming when a claim limit is used up and keeps other limits behind a disclosure", async ({ page }) => {
	const { householdId, userIds } = await createHousehold([{ user: "member", role: "DICTATOR" }]);
	await getPrisma().rewardClaimLimit.createMany({
		data: [
			{ householdId, scope: "MEMBER", period: "DAY", maxClaims: 1, sortOrder: 0 },
			{ householdId, scope: "HOUSEHOLD", period: "WEEK", maxClaims: 3, sortOrder: 1 },
			{ householdId, scope: "HOUSEHOLD", period: "ROLLING", maxClaims: 4, windowMinutes: 2880, sortOrder: 2 },
		],
	});
	await createApprovedLog({
		householdId,
		userId: userIds.member,
		description: "Spring clean",
		bucket: "MAJOR",
		points: 120,
	});

	await openDashboard(page, householdId);
	const rewards = page.getByRole("region", { name: "Rewards" });
	// 120 pts affords two rewards, but the daily limit allows only one; it stays in view.
	await expect(rewards.getByRole("status")).toHaveText("1 reward ready to claim");
	await expect(rewards.getByText("Your claims today")).toBeVisible();
	await page.getByRole("button", { name: "Claim reward · 50 pts" }).click();

	await expectBalance(page, 70);
	await expect(rewards.getByRole("status")).toContainText("You can claim again on");
	await expect(rewards.getByText("Your points are kept", { exact: true })).toBeVisible();
	await expect(rewards.getByText("0 of 1 left")).toBeVisible();
	await expect(page.getByRole("button", { name: "Claim reward" })).toHaveCount(0);

	// The two non-blocking limits are reachable but collapsed by default.
	const limits = rewards.getByRole("button", { name: "Other claim limits (2)" });
	await expect(limits).toHaveAttribute("aria-expanded", "false");
	await expect(rewards.getByText("2 of 3 left")).toBeHidden();
	await limits.click();
	await expect(limits).toHaveAttribute("aria-expanded", "true");
	await expect(rewards.getByText("2 of 3 left")).toBeVisible();
	await expect(rewards.getByText("3 of 4 left")).toBeVisible();
});

test("Quick log counts towards another member's task without confirmation or an extra badge", async ({ page }) => {
	const { householdId, userIds } = await createHousehold([
		{ user: "approver", role: "APPROVER" },
		{ user: "member", role: "DOER" },
	]);
	const label = "Water the listed plants";
	const { presetId } = await createPreset({ householdId, createdById: userIds.approver, label, bucket: "QUICK" });
	await createAssignment({ householdId, presetId, assignedToId: userIds.approver, assignedById: userIds.approver });
	await openDashboard(page, householdId);
	await taskTile(page, label).click();
	await expect(page.getByText(`Counted towards ${USERS.approver.name}'s ${label}`, { exact: true })).toBeVisible();
	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await openTasks(page, householdId, "tab=done&userId=all");
	await expect(page.getByRole("listitem").filter({ hasText: label })).toBeVisible();
	await expect(page.getByText("Quick log", { exact: true })).toHaveCount(0);
});
