import "server-only";

import { applyUserPresetOrdering } from "@/lib/presetTaskOrdering";
import { getVisiblePresetWhere } from "@/lib/presetVisibility";
import { prisma } from "@/lib/prisma";

type CreatePresetWithOrderingInput = {
	householdId: string;
	userId: string;
	label: string;
	bucket: string;
	templateKey?: string | null;
	iconKey?: string | null;
	isShared?: boolean;
	approvalOverride?: "REQUIRE" | "SKIP" | null;
};

export const createPresetWithOrdering = async (
	tx: Pick<typeof prisma, "presetTask" | "presetTaskOrder">,
	input: CreatePresetWithOrderingInput,
) => {
	const visiblePresets = await tx.presetTask.findMany({
		where: getVisiblePresetWhere(input.householdId, input.userId),
		select: {
			id: true,
			createdAt: true,
		},
	});
	const visiblePresetIds = visiblePresets.map((preset) => preset.id);
	const existingOrders = visiblePresetIds.length
		? await tx.presetTaskOrder.findMany({
				where: {
					householdId: input.householdId,
					userId: input.userId,
					presetId: { in: visiblePresetIds },
				},
				select: {
					presetId: true,
					sortOrder: true,
				},
			})
		: [];
	const hasMissingVisibleOrderRows = existingOrders.length < visiblePresets.length;
	const orderedVisiblePresets = applyUserPresetOrdering(visiblePresets, existingOrders);

	if (hasMissingVisibleOrderRows) {
		await Promise.all(
			orderedVisiblePresets.map((preset, index) =>
				tx.presetTaskOrder.upsert({
					where: {
						householdId_userId_presetId: {
							householdId: input.householdId,
							userId: input.userId,
							presetId: preset.id,
						},
					},
					update: { sortOrder: index },
					create: {
						householdId: input.householdId,
						userId: input.userId,
						presetId: preset.id,
						sortOrder: index,
					},
				}),
			),
		);
	}

	const nextSortOrder = hasMissingVisibleOrderRows
		? orderedVisiblePresets.length
		: existingOrders.reduce((maxSortOrder, entry) => Math.max(maxSortOrder, entry.sortOrder), -1) + 1;

	const createdPreset = await tx.presetTask.create({
		data: {
			householdId: input.householdId,
			createdById: input.userId,
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
				householdId: input.householdId,
				userId: input.userId,
				presetId: createdPreset.id,
			},
		},
		update: { sortOrder: nextSortOrder },
		create: {
			householdId: input.householdId,
			userId: input.userId,
			presetId: createdPreset.id,
			sortOrder: nextSortOrder,
		},
	});

	return { preset: createdPreset, sortOrder: nextSortOrder };
};
