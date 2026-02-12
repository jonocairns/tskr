import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DURATION_KEYS } from "@/lib/points";
import { validatePresetReorderPayload } from "@/lib/presetReorderValidation";
import { applyUserPresetOrdering } from "@/lib/presetTaskOrdering";
import { createPresetWithOrdering } from "@/lib/presetTaskOrderManagement";
import { shouldClearTemplateKeyOnPresetUpdate } from "@/lib/presetTemplateKey";
import { getVisiblePresetWhere } from "@/lib/presetVisibility";
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
				where: getVisiblePresetWhere(householdId, userId),
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

		const { preset, sortOrder } = await prisma.$transaction((tx) =>
			createPresetWithOrdering(tx, {
				householdId,
				userId,
				label: input.label,
				bucket: input.bucket,
				templateKey: input.templateKey,
				iconKey: input.iconKey,
				isShared: input.isShared,
				approvalOverride: input.approvalOverride,
			}),
		);

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

		const visiblePresetIds = (
			await prisma.presetTask.findMany({
				where: getVisiblePresetWhere(householdId, userId),
				select: { id: true },
			})
		).map((preset) => preset.id);

		const validation = validatePresetReorderPayload({
			orderedPresetIds: input.orderedPresetIds,
			visiblePresetIds,
		});
		if (!validation.ok) {
			throw new TRPCError({ code: validation.code, message: validation.message });
		}
		const { uniquePresetIds } = validation;

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
