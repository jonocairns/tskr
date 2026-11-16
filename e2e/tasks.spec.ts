import { expect, test } from "@playwright/test";
import { openTasks } from "./support/dashboard";
import { createApprovedLog, createAssignment, createHousehold, createPreset } from "./support/db";
import { AUTH_STATE } from "./support/env";

test.use({ storageState: AUTH_STATE.member });

test("redirects week ranges to Done and lists assigned work on To do", async ({ page }) => {
	const { householdId, userIds } = await createHousehold([
		{ user: "approver", role: "APPROVER" },
		{ user: "member", role: "DOER" },
	]);
	const { presetId } = await createPreset({
		householdId,
		createdById: userIds.approver,
		label: "Water the plants",
		bucket: "QUICK",
	});
	await createAssignment({ householdId, presetId, assignedToId: userIds.member, assignedById: userIds.approver });
	await createApprovedLog({ householdId, userId: userIds.member, description: "Wiped the bench", bucket: "QUICK" });

	await openTasks(page, householdId, "preset=calendarWeek&userId=all", "week");
	await expect(page).toHaveURL(new RegExp(`/${householdId}/tasks\\?preset=calendarWeek&userId=all&tab=done$`));
	await expect(page.getByRole("link", { name: "Done", exact: true })).toHaveAttribute("aria-current", "page");
	await expect(page.getByText("Wiped the bench", { exact: true })).toBeVisible();
	await expect(page.getByText("Quick log", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Complete Water the plants" })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "This week", exact: true })).toBeVisible();

	await page.getByRole("link", { name: "To do", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/${householdId}/tasks\\?userId=all&preset=calendarWeek$`));
	await expect(page.getByRole("combobox", { name: "Member" })).toBeVisible();
	await expect(page.getByRole("button", { name: "This week", exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Complete Water the plants" })).toBeVisible();

	// A historical Done range must never hide today's outstanding work.
	await openTasks(page, householdId, `userId=${userIds.member}&from=2020-01-01&to=2020-01-02`);
	await page.getByRole("button", { name: "Complete Water the plants" }).click();
	await expect(page.getByText("No tasks to do right now.")).toBeVisible();
});
