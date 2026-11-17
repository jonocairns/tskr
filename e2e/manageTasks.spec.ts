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

		// New task is the default, so the name field is ready straight away.
		await expect(page.getByRole("combobox", { name: "Task", exact: true })).toHaveText("New task…");
		await page.getByLabel("Task name").fill("Water the plants");
		await page.getByRole("button", { name: "Add task" }).click();

		// The form resets for the next task and the button confirms in place.
		await expect(page.getByText("Water the plants added to All tasks.")).toBeVisible();
		await expect(page.getByRole("button", { name: "Added" })).toBeVisible();
		await expect(page.getByLabel("Task name")).toHaveValue("");
		await expect(page.getByLabel("Task name")).toBeFocused();
		await expect(page.getByRole("combobox", { name: "Task", exact: true })).toHaveText("New task…");
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

		await page.getByRole("row").filter({ hasText: "Water the plants" }).getByRole("button", { name: "Remove" }).click();
		await expect(page.getByRole("alertdialog")).toContainText("Its completions stay in Done.");
		await page.getByRole("alertdialog").getByRole("button", { name: "Remove", exact: true }).click();
		await expect(page.getByText("Task removed", { exact: true }).first()).toBeVisible();
		await expect(page.getByRole("row").filter({ hasText: "Water the plants" })).toHaveCount(0);
		await openTasks(page, householdId, "tab=done&userId=all");
		await expect(page.getByText("Water the plants", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Assigned to Avery Approver", { exact: false }).filter({ visible: true }),
		).toBeVisible();
		await expect(page.getByText("Quick log", { exact: true })).toHaveCount(0);
	});

	test("keeps a task saved out of the filter until you move on", async ({ page }) => {
		const { householdId, userIds } = await createHousehold([
			{ user: "approver", role: "APPROVER" },
			{ user: "member", role: "DOER" },
		]);
		// Newest first: Vacuum lists above Dishes, so removing Vacuum would shift the row being clicked.
		for (const [label, assignedToId] of [
			["Feed the cat", null],
			["Mop the floor", userIds.approver],
			["Do the dishes", userIds.approver],
			["Vacuum the lounge", userIds.approver],
		] as const) {
			const { presetId } = await createPreset({ householdId, createdById: userIds.approver, label, bucket: "QUICK" });
			await createAssignment({ householdId, presetId, assignedToId, assignedById: userIds.approver });
		}
		await openTasks(page, householdId, "tab=manage");
		const filter = page.getByRole("combobox", { name: "Filter by assignee" });
		const row = (label: string) => page.getByRole("row").filter({ hasText: label });

		await filter.click();
		await page.getByRole("option", { name: "Avery Approver" }).click();
		await row("Vacuum the lounge")
			.getByRole("combobox", { name: /Assignee/ })
			.click();
		await page.getByRole("option", { name: "Morgan Member" }).click();
		await row("Vacuum the lounge").getByRole("button", { name: /^Save/ }).click();
		await expect(row("Vacuum the lounge").getByRole("button", { name: /saved$/ })).toBeVisible();
		await expect(row("Vacuum the lounge")).toContainText("Not in this filter");

		// It stays after the confirmation, until the next click elsewhere. Remove acts on a full click, so the
		// dialog opening proves the row below didn't shift between pointerdown and pointerup.
		await expect(row("Vacuum the lounge").getByRole("button", { name: /^Save/ })).toBeHidden();
		await expect(row("Vacuum the lounge")).toBeVisible();
		await row("Do the dishes")
			.getByRole("button", { name: /^Remove/ })
			.click();
		await expect(page.getByRole("alertdialog")).toBeVisible();
		await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
		await expect(row("Vacuum the lounge")).toHaveCount(0);
		await expect(row("Do the dishes")).toBeVisible();

		// Two quick saves out of the filter: neither row is left behind once you move on.
		for (const label of ["Do the dishes", "Mop the floor"]) {
			await row(label)
				.getByRole("combobox", { name: /Assignee/ })
				.click();
			await page.getByRole("option", { name: "Morgan Member" }).click();
		}
		await row("Do the dishes").getByRole("button", { name: /^Save/ }).click();
		await expect(row("Do the dishes").getByRole("button", { name: /saved$/ })).toBeVisible();
		await row("Mop the floor").getByRole("button", { name: /^Save/ }).click();
		await expect(row("Mop the floor").getByRole("button", { name: /saved$/ })).toBeVisible();
		await page.mouse.click(5, 5);
		await expect(row("Do the dishes")).toHaveCount(0);
		await expect(row("Mop the floor")).toHaveCount(0);

		// Emptying a filter offers a way back to everything.
		await filter.click();
		await page.getByRole("option", { name: "Open" }).click();
		await row("Feed the cat")
			.getByRole("combobox", { name: /Assignee/ })
			.click();
		await page.getByRole("option", { name: "Avery Approver" }).click();
		await row("Feed the cat").getByRole("button", { name: /^Save/ }).click();
		await expect(row("Feed the cat").getByRole("button", { name: /saved$/ })).toBeVisible();
		await page.mouse.click(5, 5);
		await expect(page.getByText("No tasks match this filter.")).toBeVisible();
		await page.getByRole("button", { name: "Show all assignees" }).click();
		await expect(row("Feed the cat")).toBeVisible();
		await expect(row("Vacuum the lounge")).toBeVisible();
		await expect(row("Mop the floor")).toBeVisible();
	});
});
