import { expect, test } from "@playwright/test";
import { expectBalance, openDashboard, openTasks } from "./support/dashboard";
import { createAssignment, createHousehold, createPreset } from "./support/db";
import { AUTH_STATE } from "./support/env";

test.use({ storageState: AUTH_STATE.member });

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

	test("creates a task from an empty household dashboard", async ({ page }) => {
		const { householdId } = await createHousehold([
			{ user: "approver", role: "APPROVER" },
			{ user: "member", role: "DOER" },
		]);

		// Reach the form from the dashboard board, after hydration.
		await openDashboard(page, householdId);
		await expect(page.getByText("No tasks to do right now.")).toBeVisible();
		await expect(page.getByText("To do", { exact: true })).toBeVisible();
		await page.getByRole("link", { name: "Add task" }).click();
		await expect(page).toHaveURL(new RegExp(`/${householdId}/tasks[?]tab=manage$`));

		await page.getByRole("combobox", { name: "Task", exact: true }).click();
		await page.getByRole("option", { name: "New task…" }).click();
		await page.getByLabel("Task name").fill("Water the plants");
		await page.getByRole("button", { name: "Add task" }).click();

		await expect(page.getByText("Task added").first()).toBeVisible();
		await expect(page.getByRole("combobox", { name: "Task", exact: true })).toHaveText("Water the plants");
		await expect(page.getByText("All tasks", { exact: true })).toBeVisible();
		await expect(page.getByRole("row").filter({ hasText: "Water the plants" })).toBeVisible();
		await expect(page.getByRole("combobox", { name: "Member", exact: true })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Date range" })).toHaveCount(0);

		await openTasks(page, householdId, "", "assignments");
		await expect(page).toHaveURL(new RegExp(`/${householdId}/tasks[?]tab=manage$`));
		await expect(page.getByRole("link", { name: "Manage", exact: true })).toHaveAttribute("aria-current", "page");

		// The new task is on the approver's own board, ready to complete.
		await openDashboard(page, householdId);
		await expect(page.getByRole("button", { name: "Complete Water the plants" })).toBeVisible();
		await page.getByRole("button", { name: "Complete Water the plants" }).click();
		await expect(page.getByText("No tasks to do right now.")).toBeVisible();

		// Fulfilled tasks remain manageable, independent of member and display range.
		const rangeQuery = "userId=all&from=2020-01-01&to=2020-01-02";
		await openTasks(page, householdId, `tab=manage&${rangeQuery}`);
		await expect(page.getByRole("row").filter({ hasText: "Water the plants" })).toContainText("1/1 this cycle");
		await expect(page.getByRole("link", { name: "Done", exact: true })).toHaveAttribute(
			"href",
			`/${householdId}/tasks?tab=done&${rangeQuery}`,
		);
	});
});
