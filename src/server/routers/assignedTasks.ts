import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DURATION_KEYS, type DurationKey, getBucketPoints } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE } from "@/lib/timeZones";
import { ensureAssignedTaskCapacity, getAssignedTaskStatus, lockAssignedTask } from "@/server/assignedTaskState";
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
		const { id } = input;

		return prisma.$transaction(async (tx) => {
			await lockAssignedTask(tx, id, householdId);
			const task = await tx.assignedTask.findFirst({ where: { id, householdId } });
			if (!task) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Assigned task not found" });
			}

			const isRecurring = input.isRecurring ?? task.isRecurring;
			const cadenceTarget = isRecurring ? (input.cadenceTarget ?? task.cadenceTarget) : 1;
			const status = await getAssignedTaskStatus(tx, { ...task, isRecurring, cadenceTarget }, householdId);
			const assignedTask = await tx.assignedTask.update({
				where: { id },
				data: {
					isRecurring,
					cadenceTarget,
					cadenceIntervalMinutes: input.cadenceIntervalMinutes ?? task.cadenceIntervalMinutes,
					status,
				},
			});
			return { assignedTask };
		});
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

		return prisma.$transaction(async (tx) => {
			await lockAssignedTask(tx, id, householdId);
			const task = await tx.assignedTask.findFirst({
				where: { id, householdId },
				include: {
					household: { select: { timeZone: true } },
					preset: { select: { id: true, label: true, bucket: true, approvalOverride: true } },
				},
			});
			if (!task?.preset) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Assigned task not found" });
			}
			if (task.assignedToId !== userId) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
			}
			if (task.status !== "ACTIVE") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Task is not active" });
			}

			const membership = await tx.householdMember.findUnique({
				where: { householdId_userId: { householdId, userId } },
				select: { requiresApprovalDefault: true },
			});
			if (!membership) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Household membership not found" });
			}

			// Use the same instant for the eligibility check and the saved completion,
			// even if the request crosses a household-local cadence boundary.
			const completedAt = new Date();
			await ensureAssignedTaskCapacity({
				tx,
				task,
				householdId,
				at: completedAt,
				timeZone: task.household.timeZone ?? DEFAULT_TIME_ZONE,
			});

			const bucket = isDurationKey(task.preset.bucket) ? task.preset.bucket : "QUICK";
			const override = task.preset.approvalOverride;
			const requiresApproval = override === "REQUIRE" || (override !== "SKIP" && membership.requiresApprovalDefault);
			const status = requiresApproval ? "PENDING" : "APPROVED";
			const entry = await tx.pointLog.create({
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
					createdAt: completedAt,
				},
			});
			if (!task.isRecurring && status === "APPROVED") {
				await tx.assignedTask.update({
					where: { id: task.id },
					data: { status: await getAssignedTaskStatus(tx, task, householdId) },
				});
			}
			return { entry };
		});
	}),
});
