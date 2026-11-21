import { getPointsSummaryMetrics } from "@/lib/pointsSummary";

type Input = {
	points: number;
	threshold: number;
	/** Claims the allowance still permits, or null when no claim limit applies. */
	claimsRemaining: number | null;
};

export const getRewardBadgeState = ({ points, threshold, claimsRemaining }: Input) => {
	const { progress, rewardsAvailable, canClaim } = getPointsSummaryMetrics({ points, threshold });
	if (!canClaim) return { kind: "progress" as const, points, threshold, progress };
	const count = Math.min(rewardsAvailable, claimsRemaining ?? Number.POSITIVE_INFINITY);
	return count > 0 ? { kind: "ready" as const, count } : { kind: "limited" as const, points };
};
