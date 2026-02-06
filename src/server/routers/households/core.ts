import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DATE_FORMATS, TIME_FORMATS } from "@/lib/formatDate";
import { prisma } from "@/lib/prisma";
import { getTimeZoneOptions, isValidTimeZone } from "@/lib/timeZones";
import { dictatorProcedure, householdProcedure, router } from "@/server/trpc";

const getCurrentSchema = z.object({
	householdId: z.string().min(1),
});

const updateSchema = z
	.object({
		householdId: z.string().min(1),
		name: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short"),
		rewardThreshold: z.number().int().min(1, "Threshold must be at least 1").max(10000, "Threshold is too high"),
		timeZone: z.string().trim().min(1).refine(isValidTimeZone, "Invalid time zone"),
		dateFormat: z.enum(DATE_FORMATS),
		timeFormat: z.enum(TIME_FORMATS),
		progressBarColor: z
			.string()
			.regex(/^#([0-9a-fA-F]{6})$/, "Color must be a 6-digit hex value")
			.nullable(),
	})
	.partial()
	.required({ householdId: true });

const deleteCurrentSchema = z.object({
	householdId: z.string().min(1),
});

export const householdCoreRouter = router({
	getCurrent: householdProcedure(getCurrentSchema).query(async ({ ctx }) => {
		const householdId = ctx.household.id;

		const household = await prisma.household.findUnique({
			where: { id: householdId },
			select: {
				id: true,
				name: true,
				timeZone: true,
				dateFormat: true,
				timeFormat: true,
				createdById: true,
				rewardThreshold: true,
				progressBarColor: true,
			},
		});

		if (!household) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Household not found" });
		}

		return { household, timeZones: getTimeZoneOptions() };
	}),

	updateCurrent: dictatorProcedure(updateSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
		const hasNameUpdate = input.name !== undefined && input.name.trim().length > 0;
		const hasThresholdUpdate = input.rewardThreshold !== undefined;
		const hasTimeZoneUpdate = input.timeZone !== undefined && input.timeZone.trim().length > 0;
		const hasDateFormatUpdate = input.dateFormat !== undefined;
		const hasTimeFormatUpdate = input.timeFormat !== undefined;
		const hasColorUpdate = input.progressBarColor !== undefined;

		if (
			!hasNameUpdate &&
			!hasThresholdUpdate &&
			!hasTimeZoneUpdate &&
			!hasDateFormatUpdate &&
			!hasTimeFormatUpdate &&
			!hasColorUpdate
		) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "No updates provided" });
		}

		const household = await prisma.household.update({
			where: { id: householdId },
			data: {
				...(hasNameUpdate && input.name ? { name: input.name.trim() } : {}),
				...(hasThresholdUpdate && input.rewardThreshold !== undefined
					? { rewardThreshold: input.rewardThreshold }
					: {}),
				...(hasTimeZoneUpdate && input.timeZone ? { timeZone: input.timeZone.trim() } : {}),
				...(hasDateFormatUpdate && input.dateFormat ? { dateFormat: input.dateFormat } : {}),
				...(hasTimeFormatUpdate && input.timeFormat ? { timeFormat: input.timeFormat } : {}),
				...(hasColorUpdate && input.progressBarColor !== undefined ? { progressBarColor: input.progressBarColor } : {}),
			},
			select: {
				id: true,
				name: true,
				timeZone: true,
				dateFormat: true,
				timeFormat: true,
				rewardThreshold: true,
				progressBarColor: true,
			},
		});

		return { household };
	}),

	deleteCurrent: dictatorProcedure(deleteCurrentSchema).mutation(async ({ ctx }) => {
		const householdId = ctx.household.id;
		await prisma.$transaction(async (tx) => {
			await tx.user.updateMany({
				where: { lastHouseholdId: householdId },
				data: { lastHouseholdId: null },
			});

			await tx.household.delete({
				where: { id: householdId },
			});
		});

		return { ok: true };
	}),
});
