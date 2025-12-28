export type PointsSummaryMetrics = {
	progress: number;
	pointsToGo: number;
	rewardsAvailable: number;
	carryoverPoints: number;
	nextRewardProgress: number;
	nextRewardPointsToGo: number;
	canClaim: boolean;
	showCarryover: boolean;
};

type Input = {
	points: number;
	threshold: number;
};

export function getPointsSummaryMetrics({ points, threshold }: Input): PointsSummaryMetrics {
	const hasValidThreshold = threshold > 0;
	const progress = hasValidThreshold ? Math.min(100, Math.max(0, Math.round((points / threshold) * 100))) : 100;
	const pointsToGo = hasValidThreshold ? Math.max(threshold - points, 0) : 0;
	const rewardsAvailable = hasValidThreshold ? Math.floor(points / threshold) : 0;
	const carryoverPoints = hasValidThreshold ? points % threshold : 0;
	const nextRewardProgress = hasValidThreshold ? Math.round((carryoverPoints / threshold) * 100) : 0;
	const nextRewardPointsToGo = hasValidThreshold ? Math.max(threshold - carryoverPoints, 0) : 0;
	const canClaim = points >= threshold;
	const showCarryover = canClaim && hasValidThreshold;

	return {
		progress,
		pointsToGo,
		rewardsAvailable,
		carryoverPoints,
		nextRewardProgress,
		nextRewardPointsToGo,
		canClaim,
		showCarryover,
	};
}
