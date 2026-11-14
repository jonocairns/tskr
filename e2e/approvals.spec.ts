import { expect, test } from "@playwright/test";
import { expectBalance, history, openDashboard, reloadDashboard, taskTile } from "./support/dashboard";
import { createHousehold, createPreset } from "./support/db";
import { AUTH_STATE, BASE_URL } from "./support/env";

test.use({ storageState: AUTH_STATE.member });

test("an approver approves a task logged by a member who needs approval", async ({ browser, page }) => {
	const { householdId, userIds } = await createHousehold([
		{ user: "approver", role: "APPROVER" },
		{ user: "member", role: "DOER", requiresApproval: true },
	]);
	await createPreset({ householdId, createdById: userIds.approver, label: "Fold the laundry", bucket: "ROUTINE" });

	// The member logs the task; it waits for approval and earns nothing yet.
	await openDashboard(page, householdId);
	await taskTile(page, "Fold the laundry").click();
	await expect(history(page).getByRole("row", { name: /Fold the laundry/ })).toContainText("Awaiting approval");
	await expectBalance(page, 0);

	// The approver approves it from their own dashboard.
	const approverContext = await browser.newContext({ baseURL: BASE_URL, storageState: AUTH_STATE.approver });
	try {
		const approverPage = await approverContext.newPage();
		await openDashboard(approverPage, householdId);
		const approvals = approverPage.getByRole("region", { name: "Approvals" });
		await approvals
			.getByRole("row", { name: /Fold the laundry/ })
			.getByRole("button", { name: "Approve" })
			.click();
		await expect(approvals.getByText("No tasks awaiting approval.")).toBeVisible();
	} finally {
		await approverContext.close();
	}

	// Reload rather than rely on the live-refresh event to observe the result.
	await reloadDashboard(page);
	await expect(history(page).getByRole("row", { name: /Fold the laundry/ })).not.toContainText("Awaiting approval");
	await expectBalance(page, 6);
});
