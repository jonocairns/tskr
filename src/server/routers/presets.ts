import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DURATION_KEYS } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { householdProcedure, router } from "@/server/trpc";

const presetSchema = z.object({
	label: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short"),
	bucket: z.enum(DURATION_KEYS),
	isShared: z.boolean().optional(),
	approvalOverride: z.enum(["REQUIRE", "SKIP"]).nullable().optional(),
});

const updatePresetSchema = z
	.object({
		id: z.string(),
		label: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short").optional(),
		bucket: z.enum(DURATION_KEYS).optional(),
		isShared: z.boolean().optional(),
		approvalOverride: z.enum(["REQUIRE", "SKIP"]).nullable().optional(),
	})
	.refine((data) => data.label || data.bucket || data.isShared !== undefined || data.approvalOverride !== undefined, {
		message: "No updates provided",
	});

const deletePresetSchema = z.object({
	id: z.string(),
});

export const presetsRouter = router({
	list: householdProcedure.query(async ({ ctx }) => {
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

	create: householdProcedure.input(presetSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;
		const role = ctx.household.role;

		const allowShared = role !== "DOER";
		const approvalOverride = role === "DOER" ? null : (input.approvalOverride ?? null);

		const preset = await prisma.presetTask.create({
			data: {
				householdId,
				createdById: userId,
				label: input.label,
				bucket: input.bucket,
				isShared: allowShared ? (input.isShared ?? true) : false,
				approvalOverride,
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

	update: householdProcedure.input(updatePresetSchema).mutation(async ({ ctx, input }) => {
		const { id, ...updates } = input;
		const householdId = ctx.household.id;
		const userId = ctx.session.user.id;
		const role = ctx.household.role;

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

		if (updates.isShared === true && role === "DOER") {
			throw new TRPCError({ code: "FORBIDDEN", message: "Doers cannot share presets" });
		}

		if (updates.approvalOverride !== undefined && role === "DOER") {
			throw new TRPCError({ code: "FORBIDDEN", message: "Doers cannot change approval overrides" });
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

	delete: householdProcedure.input(deletePresetSchema).mutation(async ({ ctx, input }) => {
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
