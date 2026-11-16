import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
	presetApprovalOverrideSchema,
	presetBucketSchema,
	presetIconKeySchema,
	presetLabelSchema,
} from "@/lib/presetInput";
import { createPresetWithOrdering } from "@/lib/presetTaskOrderManagement";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE } from "@/lib/timeZones";
import { ensureAssignedTaskCapacity, getAssignedTaskStatus, lockAssignedTask } from "@/server/assignedTaskState";
import { notifyTaskCompleted, writePresetCompletion } from "@/server/presetCompletion";
import { approverProcedure, householdProcedure, router } from "@/server/trpc";

const assignmentFieldsSchema = z.object({
	householdId: z.string().min(1),
	assigneeId: z.string().min(1).nullish(),
	cadenceTarget: z.number().int().min(1),
	cadenceIntervalMinutes: z.number().int().min(1),
	isRecurring: z.boolean(),
});

const createAssignedTaskSchema = assignmentFieldsSchema.extend({
	presetId: z.string().min(1),
});

const createAssignedTaskWithPresetSchema = assignmentFieldsSchema.extend({
	preset: z.object({
		label: presetLabelSchema,
		bucket: presetBucketSchema,
		iconKey: presetIconKeySchema,
		approvalOverride: presetApprovalOverrideSchema,
	}),
});

const updateAssignedTaskSchema = z
	.object({
		householdId: z.string().min(1),
		id: z.string(),
		assigneeId: z.string().min(1).nullish(),
		cadenceTarget: z.number().int().min(1).optional(),
		cadenceIntervalMinutes: z.number().int().min(1).optional(),
		isRecurring: z.boolean().optional(),
	})
	.refine(
		(data) =>
			data.assigneeId !== undefined ||
			data.cadenceTarget !== undefined ||
			data.cadenceIntervalMinutes !== undefined ||
			data.isRecurring !== undefined,
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

type AssignmentFields = z.infer<typeof assignmentFieldsSchema>;

const assertHouseholdAssignee = async (
	db: Pick<typeof prisma, "householdMember">,
	householdId: string,
	assigneeId: string | null | undefined,
) => {
	if (!assigneeId) {
		return;
	}
	const member = await db.householdMember.findFirst({
		where: { householdId, userId: assigneeId },
		select: { id: true },
	});
	if (!member) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee not found in household" });
	}
};

const buildAssignedTaskData = (
	householdId: string,
	presetId: string,
	assignedById: string,
	{ assigneeId, cadenceTarget, cadenceIntervalMinutes, isRecurring }: AssignmentFields,
) => ({
	householdId,
	presetId,
	assignedToId: assigneeId,
	assignedById,
	cadenceTarget: isRecurring ? cadenceTarget : 1,
	cadenceIntervalMinutes: Math.max(1, cadenceIntervalMinutes),
	isRecurring,
	status: "ACTIVE" as const,
});

export const assignedTasksRouter = router({
	create: approverProcedure(createAssignedTaskSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const { presetId, ...assignment } = input;

		try {
			return await prisma.$transaction(async (tx) => {
				await lockAssignedTask(tx, "", householdId);
				await assertHouseholdAssignee(tx, householdId, assignment.assigneeId);
				const preset = await tx.presetTask.findFirst({
					where: { id: presetId, householdId, archivedAt: null },
					select: { id: true, isShared: true },
				});
				if (!preset) throw new TRPCError({ code: "BAD_REQUEST", message: "Task not found" });
				if (!preset.isShared) {
					throw new TRPCError({ code: "BAD_REQUEST", message: "Only shared tasks can be added to the list" });
				}
				const assignedTask = await tx.assignedTask.create({
					data: buildAssignedTaskData(householdId, preset.id, ctx.session.user.id, assignment),
				});
				return { assignedTask };
			});
		} catch (error) {
			if (error instanceof TRPCError) throw error;
			console.error("[assignedTasks:create]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to add task" });
		}
	}),

	// Creates a shared preset and its assignment together, so a failed assignment never leaves an orphan preset.
	createWithPreset: approverProcedure(createAssignedTaskWithPresetSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;
		const { preset: presetInput, ...assignment } = input;

		try {
			return await prisma.$transaction(async (tx) => {
				// A no-match update still acquires SQLite's write lock before any reads.
				await lockAssignedTask(tx, "", householdId);
				await assertHouseholdAssignee(tx, householdId, assignment.assigneeId);
				const { preset, sortOrder } = await createPresetWithOrdering(tx, {
					householdId,
					userId,
					label: presetInput.label,
					bucket: presetInput.bucket,
					iconKey: presetInput.iconKey,
					approvalOverride: presetInput.approvalOverride,
					isShared: true,
				});
				const assignedTask = await tx.assignedTask.create({
					data: buildAssignedTaskData(householdId, preset.id, userId, assignment),
				});
				return { preset: { ...preset, sortOrder }, assignedTask };
			});
		} catch (error) {
			if (error instanceof TRPCError) {
				throw error;
			}
			console.error("[assignedTasks:createWithPreset]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to add task" });
		}
	}),

	update: approverProcedure(updateAssignedTaskSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const { id } = input;

		return prisma.$transaction(async (tx) => {
			await lockAssignedTask(tx, id, householdId);
			const task = await tx.assignedTask.findFirst({ where: { id, householdId, archivedAt: null } });
			if (!task) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
			}
			if (input.assigneeId) {
				const member = await tx.householdMember.findFirst({
					where: { householdId, userId: input.assigneeId },
					select: { id: true },
				});
				if (!member) {
					throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee not found in household" });
				}
			}

			const isRecurring = input.isRecurring ?? task.isRecurring;
			const cadenceTarget = isRecurring ? (input.cadenceTarget ?? task.cadenceTarget) : 1;
			const status = await getAssignedTaskStatus(tx, { ...task, isRecurring, cadenceTarget }, householdId);
			const assignedTask = await tx.assignedTask.update({
				where: { id },
				data: {
					assignedToId: input.assigneeId,
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

		return prisma.$transaction(async (tx) => {
			await lockAssignedTask(tx, id, householdId);
			const task = await tx.assignedTask.findFirst({
				where: { id, householdId, archivedAt: null },
				select: { id: true },
			});
			if (!task) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
			}
			await tx.assignedTask.update({ where: { id }, data: { archivedAt: new Date() } });
			return { ok: true };
		});
	}),

	complete: householdProcedure(completeAssignedTaskSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;
		const { id } = input;

		const { entry, task } = await prisma.$transaction(async (tx) => {
			await lockAssignedTask(tx, id, householdId);
			const task = await tx.assignedTask.findFirst({
				where: { id, householdId, archivedAt: null },
				include: {
					assignedTo: { select: { name: true, email: true } },
					household: { select: { timeZone: true } },
					preset: { select: { id: true, label: true, bucket: true, approvalOverride: true } },
				},
			});
			if (!task?.preset) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
			}
			if (task.status !== "ACTIVE") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Task is not active" });
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

			const entry = await writePresetCompletion(tx, {
				householdId,
				userId,
				preset: task.preset,
				task,
				at: completedAt,
			});
			return { entry, task };
		});

		await notifyTaskCompleted({ householdId, user: ctx.session.user, entry, task });
		return { entry };
	}),
});
