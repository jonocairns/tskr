import type { PointLog, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { getRewardClaimAllowance, type RewardClaimReader, type RewardClaimSettings } from "@/lib/rewardClaimLimits";

type ClaimTransaction = RewardClaimReader & {
	household: {
		findUniqueOrThrow: (args: {
			where: { id: string };
			select: {
				rewardThreshold: true;
				rewardClaimLimits: { orderBy: { sortOrder: "asc" } };
				timeZone: true;
			};
		}) => Promise<RewardClaimSettings & { rewardThreshold: number }>;
	};
	pointLog: {
		aggregate: (args: { where: Prisma.PointLogWhereInput; _sum: { points: true } }) => Promise<{
			_sum: { points: number | null };
		}>;
		create: (args: { data: Prisma.PointLogUncheckedCreateInput }) => Promise<PointLog>;
	};
};

// The caller must keep the allowance check and point deduction in one transaction.
export const claimReward = async (tx: ClaimTransaction, userId: string, householdId: string) => {
	const household = await tx.household.findUniqueOrThrow({
		where: { id: householdId },
		select: {
			rewardThreshold: true,
			rewardClaimLimits: { orderBy: { sortOrder: "asc" } },
			timeZone: true,
		},
	});
	const now = new Date();
	const allowance = await getRewardClaimAllowance(tx, household, householdId, userId, now);
	if (allowance?.remaining === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Reward claim limit reached for this period",
			cause: { appErrorCode: "REWARD_CLAIM_LIMIT_REACHED" },
		});
	}

	const total = await tx.pointLog.aggregate({
		where: { userId, householdId, revertedAt: null, status: "APPROVED" },
		_sum: { points: true },
	});
	const available = total._sum.points ?? 0;
	const threshold = household.rewardThreshold;
	if (available < threshold) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Not enough points to claim",
			cause: { available, threshold },
		});
	}

	const entry = await tx.pointLog.create({
		data: {
			householdId,
			userId,
			kind: "REWARD",
			points: -threshold,
			rewardCost: threshold,
			description: "Reward claimed",
			createdAt: now,
		},
	});
	return { entry, remaining: available - threshold };
};
