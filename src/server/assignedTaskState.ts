import "server-only";

import type { AssignedTask } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { computeAssignedTaskState } from "@/lib/assignedTasks";
import type { prisma } from "@/lib/prisma";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type TaskConfig = Pick<AssignedTask, "id" | "isRecurring" | "cadenceTarget" | "cadenceIntervalMinutes">;

export const lockAssignedTask = async (tx: TransactionClient, id: string, householdId: string) => {
	// SQLite transactions start deferred. Take the write lock before reading capacity,
	// including when another server process is using the same database.
	await tx.$executeRaw`UPDATE "AssignedTask" SET "status" = "status" WHERE "id" = ${id} AND "householdId" = ${householdId}`;
};

export const ensureAssignedTaskCapacity = async ({
	tx,
	task,
	householdId,
	at,
	timeZone,
}: {
	tx: TransactionClient;
	task: TaskConfig;
	householdId: string;
	at: Date;
	timeZone: string;
}) => {
	const logs = await tx.pointLog.findMany({
		where: {
			assignedTaskId: task.id,
			householdId,
			revertedAt: null,
			status: { in: ["PENDING", "APPROVED"] },
		},
		select: { createdAt: true },
	});
	const state = computeAssignedTaskState({ task, logs, now: at, timeZone });
	if (!state.isActive) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Task already completed for this cadence" });
	}
};

export const getAssignedTaskStatus = async (
	tx: TransactionClient,
	task: Pick<AssignedTask, "id" | "isRecurring" | "cadenceTarget">,
	householdId: string,
) => {
	if (task.isRecurring) {
		return "ACTIVE" as const;
	}
	const approvedCount = await tx.pointLog.count({
		where: { assignedTaskId: task.id, householdId, revertedAt: null, status: "APPROVED" },
	});
	return approvedCount >= task.cadenceTarget ? ("COMPLETED" as const) : ("ACTIVE" as const);
};
