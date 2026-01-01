import "server-only";

import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { buildAuditEntries } from "@/lib/dashboard/buildAuditEntries";
import { DURATION_KEYS, type DurationKey, findPreset, getBucketPoints } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { broadcastPush, isPushConfigured } from "@/lib/push";
import { protectedProcedure, router, validateHouseholdMembershipFromInput } from "@/server/trpc";

const presetSchema = z
	.object({
		householdId: z.string().min(1),
		type: z.literal("preset"),
		presetKey: z.string().min(1).optional(),
		presetId: z.string().min(1).optional(),
		description: z.string().max(120).optional(),
	})
	.refine((data) => Boolean(data.presetKey) !== Boolean(data.presetId), {
		message: "Provide presetKey or presetId",
		path: ["presetKey"],
	});

const timedSchema = z.object({
	householdId: z.string().min(1),
	type: z.literal("timed"),
	bucket: z.enum(DURATION_KEYS),
	description: z.string().min(1, "Describe what you did").max(160, "Keep the note short"),
	durationMinutes: z.number().int().positive().max(120).optional(),
});

const createLogSchema = z.union([presetSchema, timedSchema]);

const historyQuerySchema = z.object({
	householdId: z.string().min(1),
	offset: z.number().int().min(0).default(0),
	limit: z.number().int().min(1).max(50).default(10),
});

const updateLogSchema = z.object({
	householdId: z.string().min(1),
	id: z.string(),
	action: z.enum(["approve", "reject", "resubmit", "revert"]),
});

export const logsRouter = router({
	getHistory: protectedProcedure.input(historyQuerySchema).query(async ({ ctx, input }) => {
		const { householdId } = await validateHouseholdMembershipFromInput(ctx.session.user.id, input);

		const take = input.limit + 1;
		const logs = await prisma.pointLog.findMany({
			where: { householdId },
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { createdAt: "desc" },
			skip: input.offset,
			take,
		});

		const hasMore = logs.length > input.limit;
		const trimmedLogs = hasMore ? logs.slice(0, input.limit) : logs;

		return {
			entries: buildAuditEntries(trimmedLogs),
			hasMore,
		};
	}),

	create: protectedProcedure.input(createLogSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;
		const actorLabel = ctx.session.user.name ?? ctx.session.user.email ?? "Someone";

		const { householdId, membership } = await validateHouseholdMembershipFromInput(userId, input);

		const notifyTask = async (description: string, points: number) => {
			if (!isPushConfigured()) {
				return;
			}

			const trimmed = description.length > 96 ? `${description.slice(0, 93)}...` : description;

			try {
				await broadcastPush(
					{
						title: "Task logged",
						body: `${actorLabel} logged ${points} points for "${trimmed}"`,
						url: "/",
						icon: "/icon-192.png",
						badge: "/icon-192.png",
					},
					{ householdId, excludeUserId: userId },
				);
			} catch (error) {
				console.error("[push] notify failed", error);
			}
		};

		const resolveRequiresApproval = (override?: string | null) => {
			if (override === "REQUIRE") {
				return true;
			}
			if (override === "SKIP") {
				return false;
			}
			return membership.requiresApprovalDefault;
		};

		const getTotalPoints = async () => {
			const total = await prisma.pointLog.aggregate({
				where: {
					userId,
					householdId,
					revertedAt: null,
					status: "APPROVED",
				},
				_sum: { points: true },
			});
			return total._sum.points ?? 0;
		};

		const createEntry = async (data: Prisma.PointLogUncheckedCreateInput) => {
			const entry = await prisma.pointLog.create({ data });
			await notifyTask(entry.description, entry.points);
			const totalPoints = await getTotalPoints();

			return { entry, totalPoints };
		};

		try {
			if (input.type === "preset") {
				if (input.presetId) {
					const preset = await prisma.presetTask.findFirst({
						where: {
							id: input.presetId,
							householdId,
							OR: [{ isShared: true }, { createdById: userId }],
						},
						select: {
							id: true,
							label: true,
							bucket: true,
							approvalOverride: true,
						},
					});

					if (!preset) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown preset task" });
					}

					const bucket = DURATION_KEYS.includes(preset.bucket as DurationKey) ? (preset.bucket as DurationKey) : null;

					if (!bucket) {
						throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown preset task" });
					}

					const requiresApproval = resolveRequiresApproval(preset.approvalOverride);
					const status = requiresApproval ? "PENDING" : "APPROVED";
					return createEntry({
						householdId,
						userId,
						kind: "PRESET",
						duration: bucket,
						points: getBucketPoints(bucket),
						description: input.description?.trim() || preset.label,
						presetId: preset.id,
						status,
					});
				}

				const preset = findPreset(input.presetKey ?? "");
				if (!preset) {
					throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown preset task" });
				}

				const requiresApproval = resolveRequiresApproval(null);
				const status = requiresApproval ? "PENDING" : "APPROVED";
				return createEntry({
					householdId,
					userId,
					kind: "PRESET",
					duration: preset.bucket,
					points: getBucketPoints(preset.bucket),
					description: input.description?.trim() || preset.label,
					presetKey: preset.key,
					status,
				});
			}

			const requiresApproval = resolveRequiresApproval(null);
			const status = requiresApproval ? "PENDING" : "APPROVED";
			return createEntry({
				householdId,
				userId,
				kind: "TIMED",
				duration: input.bucket,
				durationMinutes: input.durationMinutes,
				points: getBucketPoints(input.bucket),
				description: input.description.trim(),
				status,
			});
		} catch (error) {
			console.error("[logs:create]", error);
			if (error instanceof TRPCError) {
				throw error;
			}
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to log task" });
		}
	}),

	updateStatus: protectedProcedure.input(updateLogSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;

		const log = await prisma.pointLog.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				userId: true,
				householdId: true,
				revertedAt: true,
				status: true,
				kind: true,
				assignedTaskId: true,
			},
		});

		if (!log) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Log not found" });
		}

		const membership = await prisma.householdMember.findUnique({
			where: {
				householdId_userId: {
					householdId: log.householdId,
					userId,
				},
			},
			select: {
				role: true,
			},
		});

		if (!membership) {
			throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this household" });
		}

		if (input.action !== "revert" && log.kind === "REWARD") {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Rewards cannot be approved" });
		}

		if (input.action === "revert") {
			if (log.userId !== userId && membership.role === "DOER") {
				throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
			}
			if (log.revertedAt) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Already reverted" });
			}

			await prisma.pointLog.update({
				where: { id: input.id },
				data: {
					revertedAt: new Date(),
					revertedById: userId,
				},
			});

			return { ok: true };
		}

		if (log.revertedAt) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Log already reverted" });
		}

		if (input.action === "approve" || input.action === "reject") {
			if (membership.role === "DOER") {
				throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
			}
			if (input.action === "approve" && log.userId === userId) {
				throw new TRPCError({ code: "FORBIDDEN", message: "You cannot approve your own tasks" });
			}
			if (log.status !== "PENDING") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending logs can be updated" });
			}

			await prisma.pointLog.update({
				where: { id: input.id },
				data:
					input.action === "approve"
						? {
								status: "APPROVED",
								approvedById: userId,
								approvedAt: new Date(),
								rejectedById: null,
								rejectedAt: null,
							}
						: {
								status: "REJECTED",
								rejectedById: userId,
								rejectedAt: new Date(),
								approvedById: null,
								approvedAt: null,
							},
			});

			if (input.action === "approve" && log.assignedTaskId) {
				const task = await prisma.assignedTask.findFirst({
					where: { id: log.assignedTaskId, householdId: log.householdId },
					select: {
						id: true,
						status: true,
						isRecurring: true,
						cadenceTarget: true,
					},
				});
				if (task && !task.isRecurring && task.status === "ACTIVE") {
					const approvedCount = await prisma.pointLog.count({
						where: {
							assignedTaskId: task.id,
							householdId: log.householdId,
							revertedAt: null,
							status: "APPROVED",
						},
					});
					if (approvedCount >= task.cadenceTarget) {
						await prisma.assignedTask.update({
							where: { id: task.id },
							data: { status: "COMPLETED" },
						});
					}
				}
			}

			return { ok: true };
		}

		if (input.action === "resubmit") {
			if (log.status !== "REJECTED") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Only rejected logs can be resubmitted" });
			}

			if (log.userId !== userId) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Only the log owner can resubmit" });
			}

			await prisma.pointLog.update({
				where: { id: input.id },
				data: {
					status: "PENDING",
					rejectedById: null,
					rejectedAt: null,
					approvedById: null,
					approvedAt: null,
				},
			});

			return { ok: true };
		}

		throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported action" });
	}),
});
