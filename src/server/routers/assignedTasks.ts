import "server-only";

import type { LogStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { computeAssignedTaskState } from "@/lib/assignedTasks";
import { DURATION_KEYS, type DurationKey, getBucketPoints } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { approverProcedure, householdProcedure, router } from "@/server/trpc";

const createAssignedTaskSchema = z.object({
	householdId: z.string().min(1),
	presetId: z.string().min(1),
	assigneeId: z.string().min(1),
	cadenceTarget: z.number().int().min(1),
	cadenceIntervalMinutes: z.number().int().min(1),
	isRecurring: z.boolean(),
});

const updateAssignedTaskSchema = z
	.object({
		householdId: z.string().min(1),
		id: z.string(),
		cadenceTarget: z.number().int().min(1).optional(),
		cadenceIntervalMinutes: z.number().int().min(1).optional(),
		isRecurring: z.boolean().optional(),
	})
	.refine(
		(data) =>
			data.cadenceTarget !== undefined || data.cadenceIntervalMinutes !== undefined || data.isRecurring !== undefined,
		{ message: "No updates provided" },
	);

const completeAssignedTaskSchema = z.object({
	householdId: z.string().min(1),
	id: z.string(),
});

const deleteAssignedTaskSchema = z.object({
	householdId: z.string().min(1),
	id: z.string(),
});

const isDurationKey = (bucket: string): bucket is DurationKey => DURATION_KEYS.includes(bucket as DurationKey);

export const assignedTasksRouter = router({
	create: approverProcedure(createAssignedTaskSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const { presetId, assigneeId, cadenceTarget, cadenceIntervalMinutes, isRecurring } = input;
		const normalizedCadenceTarget = isRecurring ? cadenceTarget : 1;
		const normalizedCadenceIntervalMinutes = Math.max(1, cadenceIntervalMinutes);

		const member = await prisma.householdMember.findFirst({
			where: { householdId, userId: assigneeId },
			select: { id: true },
		});

		if (!member) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee not found in household" });
		}

		const preset = await prisma.presetTask.findFirst({
			where: { id: presetId, householdId },
			select: { id: true },
		});

		if (!preset) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Preset not found" });
		}

		try {
			const assignedTask = await prisma.assignedTask.create({
				data: {
					householdId,
					presetId: preset.id,
					assignedToId: assigneeId,
					assignedById: ctx.session.user.id,
					cadenceTarget: normalizedCadenceTarget,
					cadenceIntervalMinutes: normalizedCadenceIntervalMinutes,
					isRecurring,
					status: "ACTIVE",
				},
			});

			return { assignedTask };
		} catch (error) {
			console.error("[assignedTasks:create]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to assign task" });
		}
	}),

	update: approverProcedure(updateAssignedTaskSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const { id, ...updates } = input;

		const task = await prisma.assignedTask.findFirst({
			where: { id, householdId },
			select: {
				id: true,
				cadenceIntervalMinutes: true,
			},
		});

		if (!task) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Assigned task not found" });
		}

		try {
			const cadenceIntervalMinutes = updates.cadenceIntervalMinutes ?? task.cadenceIntervalMinutes;
			const assignedTask = await prisma.assignedTask.update({
				where: { id },
				data: {
					isRecurring: updates.isRecurring,
					cadenceTarget: updates.isRecurring === false ? 1 : updates.cadenceTarget,
					cadenceIntervalMinutes,
				},
			});

			return { assignedTask };
		} catch (error) {
			console.error("[assignedTasks:update]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update assigned task" });
		}
	}),

	delete: approverProcedure(deleteAssignedTaskSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const { id } = input;

		const task = await prisma.assignedTask.findFirst({
			where: { id, householdId },
			select: { id: true },
		});

		if (!task) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Assigned task not found" });
		}

		try {
			await prisma.assignedTask.delete({ where: { id } });
			return { ok: true };
		} catch (error) {
			console.error("[assignedTasks:delete]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete assigned task" });
		}
	}),

	complete: householdProcedure(completeAssignedTaskSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;
		const { id } = input;

		const task = await prisma.assignedTask.findFirst({
			where: { id, householdId },
			select: {
				id: true,
				assignedToId: true,
				cadenceTarget: true,
				cadenceIntervalMinutes: true,
				isRecurring: true,
				status: true,
				preset: {
					select: { id: true, label: true, bucket: true, approvalOverride: true },
				},
			},
		});

		if (!task || !task.preset) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Assigned task not found" });
		}

		if (task.assignedToId !== userId) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
		}

		if (task.status !== "ACTIVE") {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Task is not active" });
		}

		const logs = await prisma.pointLog.findMany({
			where: {
				assignedTaskId: task.id,
				householdId,
				revertedAt: null,
				status: { in: ["PENDING" as LogStatus, "APPROVED" as LogStatus] },
			},
			select: { createdAt: true },
			orderBy: { createdAt: "asc" },
		});

		const state = computeAssignedTaskState(
			{
				cadenceTarget: task.cadenceTarget,
				cadenceIntervalMinutes: task.cadenceIntervalMinutes,
				isRecurring: task.isRecurring,
			},
			logs,
		);

		if (!state.isActive) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Task already completed for this cadence" });
		}

		const membership = await prisma.householdMember.findUnique({
			where: {
				householdId_userId: {
					householdId,
					userId,
				},
			},
			select: {
				requiresApprovalDefault: true,
			},
		});

		if (!membership) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Household membership not found" });
		}

		const resolveRequiresApproval = (override?: string | null) => {
			if (override === "REQUIRE") {
				return true;
			}
			if (override === "SKIP") {
				return false;
			}
			return membership.requiresApprovalDefault;
		};

		const bucket = isDurationKey(task.preset.bucket) ? task.preset.bucket : "QUICK";
		const requiresApproval = resolveRequiresApproval(task.preset.approvalOverride);
		const status = requiresApproval ? "PENDING" : "APPROVED";

		try {
			const entry = await prisma.pointLog.create({
				data: {
					householdId,
					userId,
					kind: "PRESET",
					duration: bucket,
					points: getBucketPoints(bucket),
					description: task.preset.label,
					presetId: task.preset.id,
					status,
					assignedTaskId: task.id,
				},
			});

			if (!task.isRecurring && status === "APPROVED") {
				const approvedCount = await prisma.pointLog.count({
					where: {
						assignedTaskId: task.id,
						householdId,
						revertedAt: null,
						status: "APPROVED" as LogStatus,
					},
				});
				if (approvedCount >= task.cadenceTarget) {
					await prisma.assignedTask.update({
						where: { id: task.id },
						data: { status: "COMPLETED" },
					});
				}
			}

			return { entry };
		} catch (error) {
			console.error("[assignedTasks:complete]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to complete task" });
		}
	}),
});
