import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getRewardClaimAllowance } from "@/lib/rewardClaimLimits";

// Feeds the points badge on pages without the dashboard's data; the dashboard passes its own values.
export const getRewardBadgeData = async (householdId: string, userId: string) => {
	try {
		const [household, total] = await Promise.all([
			prisma.household.findUniqueOrThrow({
				where: { id: householdId },
				select: {
					rewardThreshold: true,
					rewardClaimLimits: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } },
					progressBarColor: true,
					timeZone: true,
				},
			}),
			prisma.pointLog.aggregate({
				where: { userId, householdId, revertedAt: null, status: "APPROVED" },
				_sum: { points: true },
			}),
		]);
		const allowance = household.rewardClaimLimits.length
			? await getRewardClaimAllowance(prisma as unknown as Prisma.TransactionClient, household, householdId, userId)
			: null;
		return {
			points: total._sum.points ?? 0,
			threshold: household.rewardThreshold,
			claimsRemaining: allowance?.remaining ?? null,
			refreshAt: allowance?.changesAt ?? null,
			progressBarColor: household.progressBarColor,
		};
	} catch (error) {
		// The badge is decorative; never fail the page over it.
		console.error("[reward-badge] failed to load", error);
		return null;
	}
};
