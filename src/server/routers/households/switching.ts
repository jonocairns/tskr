import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { resolveActiveHouseholdId } from "@/lib/households";
import { prisma } from "@/lib/prisma";
import { protectedProcedure, router } from "@/server/trpc";

const createHouseholdSchema = z.object({
	name: z.string().trim().min(2).max(50).optional(),
});

const selectHouseholdSchema = z.object({
	householdId: z.string().min(1),
});

/**
 * Household switching router.
 * Handles listing, creating, and selecting active households.
 */
export const householdSwitchingRouter = router({
	// List all households for the current user
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const activeHouseholdId = await resolveActiveHouseholdId(userId, ctx.session.user.householdId ?? null);

		const memberships = await prisma.householdMember.findMany({
			where: { userId },
			select: {
				householdId: true,
				role: true,
				joinedAt: true,
				household: { select: { name: true } },
			},
			orderBy: { joinedAt: "asc" },
		});

		const households = memberships.map((membership) => ({
			id: membership.householdId,
			name: membership.household.name,
			role: membership.role,
		}));

		return {
			households,
			activeHouseholdId: activeHouseholdId ?? null,
		};
	}),

	// Create a new household
	create: protectedProcedure.input(createHouseholdSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;
		const defaultName = "My household";
		const name = input.name && input.name.trim().length >= 2 ? input.name.trim() : defaultName;

		const household = await prisma.household.create({
			data: {
				name,
				createdById: userId,
				members: {
					create: {
						userId,
						role: "DICTATOR",
						requiresApprovalDefault: false,
					},
				},
			},
			select: { id: true, name: true },
		});

		await prisma.user.update({
			where: { id: userId },
			data: { lastHouseholdId: household.id },
		});

		return { household };
	}),

	// Select active household
	select: protectedProcedure.input(selectHouseholdSchema).mutation(async ({ ctx, input }) => {
		const membership = await prisma.householdMember.findFirst({
			where: { userId: ctx.session.user.id, householdId: input.householdId },
			select: { householdId: true },
		});

		if (!membership) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
		}

		await prisma.user.update({
			where: { id: ctx.session.user.id },
			data: { lastHouseholdId: input.householdId },
		});

		return { ok: true };
	}),
});
