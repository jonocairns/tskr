import { getPointsSummaryMetrics } from "@/lib/pointsSummary";

type Input = {
	points: number;
	threshold: number;
	/** Claims the allowance still permits, or null when no claim limit applies. */
	claimsRemaining: number | null;
};

export const getRewardBadgeState = ({ points, threshold, claimsRemaining }: Input) => {
	const { progress, rewardsAvailable, carryoverPoints, nextRewardProgress, canClaim } = getPointsSummaryMetrics({
		points,
		threshold,
	});
	if (!canClaim) return { kind: "progress" as const, meterPoints: points, progress };
	// Like the dashboard meter, a claimable balance measures progress towards the reward after it.
	const next = { meterPoints: carryoverPoints, progress: nextRewardProgress };
	const count = Math.min(rewardsAvailable, claimsRemaining ?? Number.POSITIVE_INFINITY);
	return count > 0 ? { kind: "ready" as const, count, ...next } : { kind: "limited" as const, ...next };
};
