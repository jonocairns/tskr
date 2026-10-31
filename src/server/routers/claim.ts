import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { claimReward } from "@/lib/claimReward";
import { prisma } from "@/lib/prisma";
import { householdProcedure, router } from "@/server/trpc";

const claimRewardSchema = z.object({
	householdId: z.string().min(1),
});

export const claimRouter = router({
	claimReward: householdProcedure(claimRewardSchema).mutation(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const householdId = ctx.household.id;

		try {
			return await prisma.$transaction((tx) => claimReward(tx, userId, householdId));
		} catch (error) {
			if (error instanceof TRPCError) {
				throw error;
			}
			console.error("[claim:claimReward]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to claim reward right now" });
		}
	}),
});
