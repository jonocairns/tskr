import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { householdFromInputProcedure, router } from "@/server/trpc";

const claimRewardSchema = z.object({
	householdId: z.string().min(1),
});

export const claimRouter = router({
	claimReward: householdFromInputProcedure.input(claimRewardSchema).mutation(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const householdId = ctx.household.id;

		try {
			const result = await prisma.$transaction(async (tx) => {
				const household = await tx.household.findUnique({
					where: { id: householdId },
					select: { rewardThreshold: true },
				});
				const threshold = household?.rewardThreshold ?? 50;

				const total = await tx.pointLog.aggregate({
					where: {
						userId,
						householdId,
						revertedAt: null,
						status: "APPROVED",
					},
					_sum: { points: true },
				});
				const available = total._sum.points ?? 0;

				if (available < threshold) {
					return { ok: false, available, threshold } as const;
				}

				const entry = await tx.pointLog.create({
					data: {
						householdId,
						userId,
						kind: "REWARD",
						points: -threshold,
						rewardCost: threshold,
						description: "Reward claimed",
					},
				});

				return {
					ok: true,
					entry,
					remaining: available - threshold,
				} as const;
			});

			if (!result.ok) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Not enough points to claim",
					cause: {
						available: result.available,
						threshold: result.threshold,
					},
				});
			}

			return {
				entry: result.entry,
				remaining: result.remaining,
			};
		} catch (error) {
			if (error instanceof TRPCError) {
				throw error;
			}
			console.error("[claim:claimReward]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to claim reward right now" });
		}
	}),
});
