import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DURATION_KEYS } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { approverProcedure, householdProcedure, router } from "@/server/trpc";

const listPresetsSchema = z.object({
	householdId: z.string().min(1),
});

const presetSchema = z.object({
	householdId: z.string().min(1),
	label: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short"),
	bucket: z.enum(DURATION_KEYS),
	isShared: z.boolean().optional(),
	approvalOverride: z.enum(["REQUIRE", "SKIP"]).nullish(),
});

const updatePresetSchema = z
	.object({
		householdId: z.string().min(1),
		id: z.string(),
		label: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short").optional(),
		bucket: z.enum(DURATION_KEYS).optional(),
		isShared: z.boolean().optional(),
		approvalOverride: z.enum(["REQUIRE", "SKIP"]).nullish(),
	})
	.refine((data) => data.label || data.bucket || data.isShared !== undefined || data.approvalOverride !== undefined, {
		message: "No updates provided",
	});

const deletePresetSchema = z.object({
	householdId: z.string().min(1),
	id: z.string(),
});

export const presetsRouter = router({
	list: householdProcedure(listPresetsSchema).query(async ({ ctx }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;

		const presets = await prisma.presetTask.findMany({
			where: {
				householdId,
				OR: [{ isShared: true }, { createdById: userId }],
			},
			orderBy: [{ isShared: "desc" }, { createdAt: "asc" }],
			select: {
				id: true,
				householdId: true,
				label: true,
				bucket: true,
				isShared: true,
				createdById: true,
				approvalOverride: true,
				createdAt: true,
			},
		});

		return { presets };
	}),

	create: approverProcedure(presetSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;

		const preset = await prisma.presetTask.create({
			data: {
				householdId,
				createdById: userId,
				label: input.label,
				bucket: input.bucket,
				isShared: input.isShared ?? true,
				approvalOverride: input.approvalOverride ?? null,
			},
			select: {
				id: true,
				label: true,
				bucket: true,
				isShared: true,
				createdById: true,
				approvalOverride: true,
				createdAt: true,
			},
		});

		return { preset };
	}),

	update: approverProcedure(updatePresetSchema).mutation(async ({ ctx, input }) => {
		const { id, ...updates } = input;
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;

		const preset = await prisma.presetTask.findFirst({
			where: { id, householdId },
			select: { id: true, createdById: true, isShared: true },
		});

		if (!preset) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Preset not found" });
		}

		const isOwner = preset.createdById === userId;
		if (!preset.isShared && !isOwner) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Preset not found" });
		}

		if (updates.isShared !== undefined && !isOwner) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can change sharing" });
		}

		const updated = await prisma.presetTask.update({
			where: { id },
			data: {
				label: updates.label,
				bucket: updates.bucket,
				isShared: isOwner ? updates.isShared : undefined,
				approvalOverride: updates.approvalOverride === undefined ? undefined : updates.approvalOverride,
			},
			select: {
				id: true,
				householdId: true,
				label: true,
				bucket: true,
				isShared: true,
				createdById: true,
				approvalOverride: true,
				createdAt: true,
			},
		});

		return { preset: updated };
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
});
