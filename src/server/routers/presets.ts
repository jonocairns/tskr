import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DURATION_KEYS } from "@/lib/points";
import { applyUserPresetOrdering } from "@/lib/presetTaskOrdering";
import { shouldClearTemplateKeyOnPresetUpdate } from "@/lib/presetTemplateKey";
import { prisma } from "@/lib/prisma";
import { approverProcedure, householdProcedure, router } from "@/server/trpc";

const listPresetsSchema = z.object({
	householdId: z.string().min(1),
});

const iconKeySchema = z.string().trim().min(1).max(100).nullish();

const presetSchema = z.object({
	householdId: z.string().min(1),
	label: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short"),
	bucket: z.enum(DURATION_KEYS),
	templateKey: z.string().trim().min(1).max(100).nullish(),
	iconKey: iconKeySchema,
	isShared: z.boolean().optional(),
	approvalOverride: z.enum(["REQUIRE", "SKIP"]).nullish(),
});

const updatePresetSchema = z
	.object({
		householdId: z.string().min(1),
		id: z.string(),
		label: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short").optional(),
		bucket: z.enum(DURATION_KEYS).optional(),
		iconKey: iconKeySchema,
		isShared: z.boolean().optional(),
		approvalOverride: z.enum(["REQUIRE", "SKIP"]).nullish(),
	})
	.refine(
		(data) =>
			data.label ||
			data.bucket ||
			data.iconKey !== undefined ||
			data.isShared !== undefined ||
			data.approvalOverride !== undefined,
		{
			message: "No updates provided",
		},
	);

const deletePresetSchema = z.object({
	householdId: z.string().min(1),
	id: z.string(),
});

const reorderPresetsSchema = z.object({
	householdId: z.string().min(1),
	orderedPresetIds: z.array(z.string().min(1)).min(1),
});

export const presetsRouter = router({
	list: householdProcedure(listPresetsSchema).query(async ({ ctx }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;

		const [presets, presetOrders] = await Promise.all([
			prisma.presetTask.findMany({
				where: {
					householdId,
					OR: [{ isShared: true }, { createdById: userId }],
				},
				select: {
					id: true,
					householdId: true,
					label: true,
					bucket: true,
					templateKey: true,
					iconKey: true,
					isShared: true,
					createdById: true,
					approvalOverride: true,
					createdAt: true,
				},
			}),
			prisma.presetTaskOrder.findMany({
				where: { householdId, userId },
				select: {
					presetId: true,
					sortOrder: true,
				},
			}),
		]);

		return { presets: applyUserPresetOrdering(presets, presetOrders) };
	}),

	create: approverProcedure(presetSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;

		const { preset, sortOrder } = await prisma.$transaction(async (tx) => {
			const visiblePresets = await tx.presetTask.findMany({
				where: {
					householdId,
					OR: [{ isShared: true }, { createdById: userId }],
				},
				select: {
					id: true,
					createdAt: true,
					createdById: true,
				},
			});
			const visiblePresetIds = visiblePresets.map((preset) => preset.id);
			const existingOrders = visiblePresetIds.length
				? await tx.presetTaskOrder.findMany({
						where: {
							householdId,
							userId,
							presetId: { in: visiblePresetIds },
						},
						select: {
							presetId: true,
							sortOrder: true,
						},
					})
				: [];
			const hasMissingVisibleOrderRows = existingOrders.length < visiblePresets.length;
			const orderedPresetIdSet = new Set(existingOrders.map((entry) => entry.presetId));
			const hasSharedPresetOrderRow = visiblePresets.some(
				(preset) => orderedPresetIdSet.has(preset.id) && preset.createdById !== userId,
			);
			const orderedVisiblePresets =
				hasMissingVisibleOrderRows && !hasSharedPresetOrderRow
					? [...visiblePresets].sort((a, b) => {
							const createdAtDifference = a.createdAt.getTime() - b.createdAt.getTime();
							if (createdAtDifference !== 0) {
								return createdAtDifference;
							}

							return a.id.localeCompare(b.id);
						})
					: applyUserPresetOrdering(visiblePresets, existingOrders);

			if (hasMissingVisibleOrderRows) {
				await Promise.all(
					orderedVisiblePresets.map((preset, index) =>
						tx.presetTaskOrder.upsert({
							where: {
								householdId_userId_presetId: {
									householdId,
									userId,
									presetId: preset.id,
								},
							},
							update: { sortOrder: index },
							create: {
								householdId,
								userId,
								presetId: preset.id,
								sortOrder: index,
							},
						}),
					),
				);
			}

			const nextSortOrder = orderedVisiblePresets.length;

			const createdPreset = await tx.presetTask.create({
				data: {
					householdId,
					createdById: userId,
					label: input.label,
					bucket: input.bucket,
					templateKey: input.templateKey ?? null,
					iconKey: input.iconKey ?? null,
					isShared: input.isShared ?? true,
					approvalOverride: input.approvalOverride ?? null,
				},
				select: {
					id: true,
					label: true,
					bucket: true,
					templateKey: true,
					iconKey: true,
					isShared: true,
					createdById: true,
					approvalOverride: true,
					createdAt: true,
				},
			});

			await tx.presetTaskOrder.upsert({
				where: {
					householdId_userId_presetId: {
						householdId,
						userId,
						presetId: createdPreset.id,
					},
				},
				update: { sortOrder: nextSortOrder },
				create: {
					householdId,
					userId,
					presetId: createdPreset.id,
					sortOrder: nextSortOrder,
				},
			});

			return { preset: createdPreset, sortOrder: nextSortOrder };
		});

		return { preset: { ...preset, sortOrder } };
	}),

	update: approverProcedure(updatePresetSchema).mutation(async ({ ctx, input }) => {
		const { id, ...updates } = input;
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;

		const preset = await prisma.presetTask.findFirst({
			where: { id, householdId },
			select: {
				id: true,
				createdById: true,
				isShared: true,
				label: true,
				bucket: true,
				templateKey: true,
				iconKey: true,
			},
		});

		if (!preset) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Preset not found" });
		}

		const isOwner = preset.createdById === userId;
		if (!preset.isShared && !isOwner) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Preset not found" });
		}

		if (updates.isShared !== undefined && updates.isShared !== preset.isShared && !isOwner) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can change sharing" });
		}

		const clearTemplateKey = shouldClearTemplateKeyOnPresetUpdate({
			templateKey: preset.templateKey,
			currentLabel: preset.label,
			currentBucket: preset.bucket,
			nextLabel: updates.label,
			nextBucket: updates.bucket,
		});

		const updated = await prisma.presetTask.update({
			where: { id },
			data: {
				label: updates.label,
				bucket: updates.bucket,
				templateKey: clearTemplateKey ? null : undefined,
				iconKey: updates.iconKey === undefined ? undefined : updates.iconKey,
				isShared: isOwner ? updates.isShared : undefined,
				approvalOverride: updates.approvalOverride === undefined ? undefined : updates.approvalOverride,
			},
			select: {
				id: true,
				householdId: true,
				label: true,
				bucket: true,
				templateKey: true,
				iconKey: true,
				isShared: true,
				createdById: true,
				approvalOverride: true,
				createdAt: true,
			},
		});

		const presetOrder = await prisma.presetTaskOrder.findUnique({
			where: {
				householdId_userId_presetId: {
					householdId,
					userId,
					presetId: updated.id,
				},
			},
			select: { sortOrder: true },
		});

		return { preset: { ...updated, sortOrder: presetOrder?.sortOrder ?? 0 } };
	}),

	delete: approverProcedure(deletePresetSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;

		const preset = await prisma.presetTask.findFirst({
			where: { id: input.id, createdById: userId, householdId },
			select: { id: true },
		});

		if (!preset) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Preset not found" });
		}

		await prisma.presetTask.delete({ where: { id: input.id } });

		return { ok: true };
	}),

	reorder: approverProcedure(reorderPresetsSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;
		const uniquePresetIds = [...new Set(input.orderedPresetIds)];

		if (uniquePresetIds.length !== input.orderedPresetIds.length) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate preset id in reorder payload" });
		}

		const visiblePresetIds = (
			await prisma.presetTask.findMany({
				where: {
					householdId,
					OR: [{ isShared: true }, { createdById: userId }],
				},
				select: { id: true },
			})
		).map((preset) => preset.id);

		if (visiblePresetIds.length === 0) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "No presets available to reorder" });
		}

		const visiblePresetIdSet = new Set(visiblePresetIds);
		if (uniquePresetIds.length !== visiblePresetIds.length) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Reorder payload must include all visible presets" });
		}

		const includesUnknownPreset = uniquePresetIds.some((presetId) => !visiblePresetIdSet.has(presetId));
		if (includesUnknownPreset) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Preset not found" });
		}

		await prisma.$transaction(async (tx) => {
			await tx.presetTaskOrder.deleteMany({
				where: {
					householdId,
					userId,
					presetId: {
						in: visiblePresetIds,
					},
				},
			});

			await tx.presetTaskOrder.createMany({
				data: uniquePresetIds.map((presetId, index) => ({
					householdId,
					userId,
					presetId,
					sortOrder: index,
				})),
			});
		});

		return { ok: true };
	}),
});
