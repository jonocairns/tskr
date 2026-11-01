import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { getRewardClaimAllowance } from "@/lib/rewardClaimLimits";

// The caller must keep the allowance check and point deduction in one transaction.
export const claimReward = async (
	tx: Prisma.TransactionClient,
	userId: string,
	householdId: string,
	now = new Date(),
) => {
	const household = await tx.household.findUniqueOrThrow({
		where: { id: householdId },
		select: {
			rewardThreshold: true,
			rewardClaimLimits: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } },
			timeZone: true,
		},
	});
	const allowance = await getRewardClaimAllowance(tx, household, householdId, userId, now);
	if (allowance?.remaining === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Reward claim limit reached for this period",
			cause: {
				appErrorCode: "REWARD_CLAIM_LIMIT_REACHED",
				blockingRuleIds: allowance.rules.filter((rule) => rule.remaining === 0).map((rule) => rule.id),
			},
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
	for (const rule of allowance?.rules ?? []) {
		if (rule.period !== "MONTH") continue;
		const grant = rule.available.find((grant) => grant.remaining > 0);
		if (!grant) throw new Error("Monthly allowance changed inside claim transaction");
		await tx.rewardClaimAllocation.create({ data: { grantId: grant.grantId, logId: entry.id } });
	}
	return { entry, remaining: available - threshold };
};
