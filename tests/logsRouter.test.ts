const resolveRequiresApproval = (override: string | null | undefined, membershipDefault: boolean): boolean => {
	if (override === "REQUIRE") {
		return true;
	}
	if (override === "SKIP") {
		return false;
	}
	return membershipDefault;
};


const shouldCompleteTask = (
	task: { isRecurring: boolean; status: string; cadenceTarget: number } | null,
	approvedCount: number,
): boolean => {
	if (!task) {
		return false;
	}
	if (task.isRecurring) {
		return false;
	}
	if (task.status !== "ACTIVE") {
		return false;
	}
	return approvedCount >= task.cadenceTarget;
};


type Role = "DICTATOR" | "APPROVER" | "DOER";
type Action = "approve" | "reject" | "resubmit" | "revert";
type LogStatus = "PENDING" | "APPROVED" | "REJECTED";
type LogKind = "PRESET" | "TIMED" | "REWARD";

interface PermissionCheckInput {
	action: Action;
	userRole: Role;
	logOwnerId: string;
	actorId: string;
	logStatus: LogStatus;
	logKind: LogKind;
	isReverted: boolean;
}

const checkUpdatePermission = (input: PermissionCheckInput): { allowed: boolean; error?: string } => {
	const { action, userRole, logOwnerId, actorId, logStatus, logKind, isReverted } = input;

	// Rewards can only be reverted
	if (action !== "revert" && logKind === "REWARD") {
		return { allowed: false, error: "Rewards cannot be approved" };
	}

	// Check revert permissions
	if (action === "revert") {
		if (isReverted) {
			return { allowed: false, error: "Already reverted" };
		}
		// DOERs can only revert their own logs
		if (userRole === "DOER" && logOwnerId !== actorId) {
			return { allowed: false, error: "Forbidden" };
		}
		return { allowed: true };
	}

	// Already reverted logs can't be updated
	if (isReverted) {
		return { allowed: false, error: "Log already reverted" };
	}

	// Approve/Reject permissions
	if (action === "approve" || action === "reject") {
		// DOERs cannot approve or reject
		if (userRole === "DOER") {
			return { allowed: false, error: "Forbidden" };
		}
		// Cannot approve your own tasks
		if (action === "approve" && logOwnerId === actorId) {
			return { allowed: false, error: "You cannot approve your own tasks" };
		}
		// Can only approve/reject pending logs
		if (logStatus !== "PENDING") {
			return { allowed: false, error: "Only pending logs can be updated" };
		}
		return { allowed: true };
	}

	// Resubmit permissions
	if (action === "resubmit") {
		// Can only resubmit rejected logs
		if (logStatus !== "REJECTED") {
			return { allowed: false, error: "Only rejected logs can be resubmitted" };
		}
		// Only the owner can resubmit
		if (logOwnerId !== actorId) {
			return { allowed: false, error: "Only the log owner can resubmit" };
		}
		return { allowed: true };
	}

	return { allowed: false, error: "Unsupported action" };
};

describe("resolveRequiresApproval", () => {
	describe("override behavior", () => {
		test("returns true when override is REQUIRE", () => {
			expect(resolveRequiresApproval("REQUIRE", false)).toBe(true);
			expect(resolveRequiresApproval("REQUIRE", true)).toBe(true);
		});

		test("returns false when override is SKIP", () => {
			expect(resolveRequiresApproval("SKIP", false)).toBe(false);
			expect(resolveRequiresApproval("SKIP", true)).toBe(false);
		});

		test("uses membership default when override is null", () => {
			expect(resolveRequiresApproval(null, true)).toBe(true);
			expect(resolveRequiresApproval(null, false)).toBe(false);
		});

		test("uses membership default when override is undefined", () => {
			expect(resolveRequiresApproval(undefined, true)).toBe(true);
			expect(resolveRequiresApproval(undefined, false)).toBe(false);
		});
	});

	describe("edge cases", () => {
		test("handles empty string override as membership default", () => {
			expect(resolveRequiresApproval("", true)).toBe(true);
			expect(resolveRequiresApproval("", false)).toBe(false);
		});

		test("handles invalid override values as membership default", () => {
			expect(resolveRequiresApproval("INVALID", true)).toBe(true);
			expect(resolveRequiresApproval("INVALID", false)).toBe(false);
		});

		test("is case sensitive for override values", () => {
			expect(resolveRequiresApproval("require", false)).toBe(false); // Not REQUIRE
			expect(resolveRequiresApproval("skip", true)).toBe(true); // Not SKIP
		});

		test("handles whitespace in override", () => {
			expect(resolveRequiresApproval(" REQUIRE ", false)).toBe(false); // Not exact match
			expect(resolveRequiresApproval("REQUIRE ", false)).toBe(false); // Not exact match
		});
	});

	describe("real-world scenarios", () => {
		test("preset task with REQUIRE override always requires approval", () => {
			const result = resolveRequiresApproval("REQUIRE", false);
			expect(result).toBe(true);
		});

		test("preset task with SKIP override never requires approval", () => {
			const result = resolveRequiresApproval("SKIP", true);
			expect(result).toBe(false);
		});

		test("timed task uses user's default setting", () => {
			const userRequiresApproval = resolveRequiresApproval(null, true);
			const userAutoApproves = resolveRequiresApproval(null, false);

			expect(userRequiresApproval).toBe(true);
			expect(userAutoApproves).toBe(false);
		});
	});
});

describe("task completion logic", () => {
	describe("basic completion conditions", () => {
		test("completes non-recurring active task when target reached", () => {
			const task = { isRecurring: false, status: "ACTIVE", cadenceTarget: 3 };
			expect(shouldCompleteTask(task, 3)).toBe(true);
		});

		test("completes non-recurring active task when target exceeded", () => {
			const task = { isRecurring: false, status: "ACTIVE", cadenceTarget: 3 };
			expect(shouldCompleteTask(task, 5)).toBe(true);
		});

		test("does not complete when approved count below target", () => {
			const task = { isRecurring: false, status: "ACTIVE", cadenceTarget: 5 };
			expect(shouldCompleteTask(task, 4)).toBe(false);
		});

		test("does not complete recurring tasks", () => {
			const task = { isRecurring: true, status: "ACTIVE", cadenceTarget: 3 };
			expect(shouldCompleteTask(task, 3)).toBe(false);
			expect(shouldCompleteTask(task, 10)).toBe(false);
		});

		test("does not complete non-active tasks", () => {
			const completedTask = { isRecurring: false, status: "COMPLETED", cadenceTarget: 3 };
			const canceledTask = { isRecurring: false, status: "CANCELED", cadenceTarget: 3 };

			expect(shouldCompleteTask(completedTask, 3)).toBe(false);
			expect(shouldCompleteTask(canceledTask, 3)).toBe(false);
		});

		test("returns false when task is null", () => {
			expect(shouldCompleteTask(null, 5)).toBe(false);
		});
	});

	describe("edge cases", () => {
		test("handles zero approved count", () => {
			const task = { isRecurring: false, status: "ACTIVE", cadenceTarget: 1 };
			expect(shouldCompleteTask(task, 0)).toBe(false);
		});

		test("handles zero cadence target", () => {
			const task = { isRecurring: false, status: "ACTIVE", cadenceTarget: 0 };
			expect(shouldCompleteTask(task, 0)).toBe(true);
			expect(shouldCompleteTask(task, 1)).toBe(true);
		});

		test("handles negative approved count", () => {
			const task = { isRecurring: false, status: "ACTIVE", cadenceTarget: 3 };
			expect(shouldCompleteTask(task, -1)).toBe(false);
		});

		test("handles negative cadence target", () => {
			const task = { isRecurring: false, status: "ACTIVE", cadenceTarget: -1 };
			expect(shouldCompleteTask(task, 0)).toBe(true);
			expect(shouldCompleteTask(task, -1)).toBe(true);
		});

		test("handles very large approved count", () => {
			const task = { isRecurring: false, status: "ACTIVE", cadenceTarget: 1 };
			expect(shouldCompleteTask(task, 1000000)).toBe(true);
		});

		test("handles exact boundary at target", () => {
			const task = { isRecurring: false, status: "ACTIVE", cadenceTarget: 10 };
			expect(shouldCompleteTask(task, 9)).toBe(false);
			expect(shouldCompleteTask(task, 10)).toBe(true);
			expect(shouldCompleteTask(task, 11)).toBe(true);
		});
	});

	describe("status variations", () => {
		test("handles different status values", () => {
			const statuses = ["ACTIVE", "COMPLETED", "CANCELED", "PAUSED", "PENDING"];

			for (const status of statuses) {
				const task = { isRecurring: false, status, cadenceTarget: 1 };
				const shouldComplete = shouldCompleteTask(task, 1);

				if (status === "ACTIVE") {
					expect(shouldComplete).toBe(true);
				} else {
					expect(shouldComplete).toBe(false);
				}
			}
		});

		test("is case sensitive for status", () => {
			const task = { isRecurring: false, status: "active", cadenceTarget: 1 };
			expect(shouldCompleteTask(task, 1)).toBe(false); // Not "ACTIVE"
		});
	});
});

describe("update permission checks", () => {
	describe("approve action", () => {
		test("DICTATOR can approve pending logs from others", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});

		test("APPROVER can approve pending logs from others", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "APPROVER",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});

		test("DOER cannot approve any logs", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Forbidden");
		});

		test("cannot approve your own tasks", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("You cannot approve your own tasks");
		});

		test("can only approve pending logs", () => {
			const approved = checkUpdatePermission({
				action: "approve",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "APPROVED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(approved.allowed).toBe(false);
			expect(approved.error).toBe("Only pending logs can be updated");

			const rejected = checkUpdatePermission({
				action: "approve",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "REJECTED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(rejected.allowed).toBe(false);
		});

		test("cannot approve reverted logs", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: true,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Log already reverted");
		});

		test("cannot approve reward logs", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "REWARD",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Rewards cannot be approved");
		});
	});

	describe("reject action", () => {
		test("DICTATOR can reject pending logs", () => {
			const result = checkUpdatePermission({
				action: "reject",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});

		test("APPROVER can reject pending logs", () => {
			const result = checkUpdatePermission({
				action: "reject",
				userRole: "APPROVER",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});

		test("DOER cannot reject logs", () => {
			const result = checkUpdatePermission({
				action: "reject",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Forbidden");
		});

		test("can reject own tasks", () => {
			const result = checkUpdatePermission({
				action: "reject",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});

		test("can only reject pending logs", () => {
			const approved = checkUpdatePermission({
				action: "reject",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "APPROVED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(approved.allowed).toBe(false);
		});

		test("cannot reject reward logs", () => {
			const result = checkUpdatePermission({
				action: "reject",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "REWARD",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Rewards cannot be approved");
		});
	});

	describe("resubmit action", () => {
		test("owner can resubmit rejected logs", () => {
			const result = checkUpdatePermission({
				action: "resubmit",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "REJECTED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});

		test("non-owner cannot resubmit logs", () => {
			const result = checkUpdatePermission({
				action: "resubmit",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "REJECTED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Only the log owner can resubmit");
		});

		test("can only resubmit rejected logs", () => {
			const pending = checkUpdatePermission({
				action: "resubmit",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(pending.allowed).toBe(false);
			expect(pending.error).toBe("Only rejected logs can be resubmitted");

			const approved = checkUpdatePermission({
				action: "resubmit",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "APPROVED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(approved.allowed).toBe(false);
		});

		test("cannot resubmit reverted logs", () => {
			const result = checkUpdatePermission({
				action: "resubmit",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "REJECTED",
				logKind: "PRESET",
				isReverted: true,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Log already reverted");
		});

		test("can resubmit any log kind if rejected (including rewards)", () => {
			const result = checkUpdatePermission({
				action: "resubmit",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "REJECTED",
				logKind: "TIMED",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});
	});

	describe("revert action", () => {
		test("owner can revert their own logs", () => {
			const doer = checkUpdatePermission({
				action: "revert",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "APPROVED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(doer.allowed).toBe(true);
		});

		test("DOER cannot revert others logs", () => {
			const result = checkUpdatePermission({
				action: "revert",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "APPROVED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Forbidden");
		});

		test("APPROVER can revert any logs", () => {
			const result = checkUpdatePermission({
				action: "revert",
				userRole: "APPROVER",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "APPROVED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});

		test("DICTATOR can revert any logs", () => {
			const result = checkUpdatePermission({
				action: "revert",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "APPROVED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});

		test("cannot revert already reverted logs", () => {
			const result = checkUpdatePermission({
				action: "revert",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "APPROVED",
				logKind: "PRESET",
				isReverted: true,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Already reverted");
		});

		test("can revert logs in any status", () => {
			const statuses: LogStatus[] = ["PENDING", "APPROVED", "REJECTED"];

			for (const status of statuses) {
				const result = checkUpdatePermission({
					action: "revert",
					userRole: "DICTATOR",
					logOwnerId: "user-1",
					actorId: "user-2",
					logStatus: status,
					logKind: "PRESET",
					isReverted: false,
				});
				expect(result.allowed).toBe(true);
			}
		});

		test("can revert reward logs", () => {
			const result = checkUpdatePermission({
				action: "revert",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "APPROVED",
				logKind: "REWARD",
				isReverted: false,
			});
			expect(result.allowed).toBe(true);
		});
	});

	describe("edge cases and complex scenarios", () => {
		test("handles all role types consistently", () => {
			const roles: Role[] = ["DICTATOR", "APPROVER", "DOER"];

			for (const role of roles) {
				// Test approve action
				const canApprove = checkUpdatePermission({
					action: "approve",
					userRole: role,
					logOwnerId: "user-1",
					actorId: "user-2",
					logStatus: "PENDING",
					logKind: "PRESET",
					isReverted: false,
				});

				if (role === "DOER") {
					expect(canApprove.allowed).toBe(false);
				} else {
					expect(canApprove.allowed).toBe(true);
				}
			}
		});

		test("handles all log kinds for revert", () => {
			const kinds: LogKind[] = ["PRESET", "TIMED", "REWARD"];

			for (const kind of kinds) {
				const result = checkUpdatePermission({
					action: "revert",
					userRole: "DICTATOR",
					logOwnerId: "user-1",
					actorId: "user-2",
					logStatus: "APPROVED",
					logKind: kind,
					isReverted: false,
				});
				expect(result.allowed).toBe(true);
			}
		});

		test("multiple permission failures return first error", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Forbidden");
		});

		test("reward + approve returns specific error", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "REWARD",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Rewards cannot be approved");
		});

		test("reverted + approve returns reverted error", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: true,
			});
			expect(result.allowed).toBe(false);
			expect(result.error).toBe("Log already reverted");
		});
	});

	describe("real-world scenarios", () => {
		test("scenario: complete approval workflow", () => {
			const approve = checkUpdatePermission({
				action: "approve",
				userRole: "APPROVER",
				logOwnerId: "user-1",
				actorId: "approver-1",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(approve.allowed).toBe(true);

			const revert = checkUpdatePermission({
				action: "revert",
				userRole: "DICTATOR",
				logOwnerId: "user-1",
				actorId: "dictator-1",
				logStatus: "APPROVED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(revert.allowed).toBe(true);
		});

		test("scenario: rejection and resubmit workflow", () => {
			const reject = checkUpdatePermission({
				action: "reject",
				userRole: "APPROVER",
				logOwnerId: "user-1",
				actorId: "approver-1",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(reject.allowed).toBe(true);

			const resubmit = checkUpdatePermission({
				action: "resubmit",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "REJECTED",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(resubmit.allowed).toBe(true);
		});

		test("scenario: user tries to approve own task (prevented)", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "APPROVER",
				logOwnerId: "user-1",
				actorId: "user-1",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
		});

		test("scenario: doer tries to approve any task (prevented)", () => {
			const result = checkUpdatePermission({
				action: "approve",
				userRole: "DOER",
				logOwnerId: "user-1",
				actorId: "user-2",
				logStatus: "PENDING",
				logKind: "PRESET",
				isReverted: false,
			});
			expect(result.allowed).toBe(false);
		});
	});
});
