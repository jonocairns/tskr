import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { dictatorProcedure, householdProcedure, router } from "@/server/trpc";

const updateSchema = z.object({
	name: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short"),
	rewardThreshold: z.number().int().min(1, "Threshold must be at least 1").max(10000, "Threshold is too high"),
	progressBarColor: z
		.string()
		.regex(/^#([0-9a-fA-F]{6})$/, "Color must be a 6-digit hex value")
		.nullable(),
});

export const householdCoreRouter = router({
	getCurrent: householdProcedure.query(async ({ ctx }) => {
		const household = await prisma.household.findUnique({
			where: { id: ctx.household.id },
			select: {
				id: true,
				name: true,
				createdById: true,
				rewardThreshold: true,
				progressBarColor: true,
			},
		});

		if (!household) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Household not found" });
		}

		return { household };
	}),

	updateCurrent: dictatorProcedure.input(updateSchema.partial()).mutation(async ({ ctx, input }) => {
		const hasNameUpdate = input.name !== undefined && input.name.trim().length > 0;
		const hasThresholdUpdate = input.rewardThreshold !== undefined;
		const hasColorUpdate = input.progressBarColor !== undefined;

		if (!hasNameUpdate && !hasThresholdUpdate && !hasColorUpdate) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "No updates provided" });
		}

		const household = await prisma.household.update({
			where: { id: ctx.household.id },
			data: {
				...(hasNameUpdate && input.name ? { name: input.name.trim() } : {}),
				...(hasThresholdUpdate && input.rewardThreshold !== undefined
					? { rewardThreshold: input.rewardThreshold }
					: {}),
				...(hasColorUpdate && input.progressBarColor !== undefined ? { progressBarColor: input.progressBarColor } : {}),
			},
			select: {
				id: true,
				name: true,
				rewardThreshold: true,
				progressBarColor: true,
			},
		});

		return { household };
	}),

	deleteCurrent: dictatorProcedure.mutation(async ({ ctx }) => {
		await prisma.$transaction(async (tx) => {
			await tx.user.updateMany({
				where: { lastHouseholdId: ctx.household.id },
				data: { lastHouseholdId: null },
			});

			await tx.household.delete({
				where: { id: ctx.household.id },
			});
		});

		return { ok: true };
	}),
});
