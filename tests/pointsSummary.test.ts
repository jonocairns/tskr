import { getPointsSummaryMetrics } from "../src/lib/pointsSummary";

test("computes progress and points to go before threshold", () => {
	const metrics = getPointsSummaryMetrics({ points: 45, threshold: 100 });

	expect(metrics.progress).toBe(45);
	expect(metrics.pointsToGo).toBe(55);
	expect(metrics.rewardsAvailable).toBe(0);
	expect(metrics.carryoverPoints).toBe(45);
	expect(metrics.nextRewardProgress).toBe(45);
	expect(metrics.nextRewardPointsToGo).toBe(55);
	expect(metrics.canClaim).toBe(false);
	expect(metrics.showCarryover).toBe(false);
});

test("computes carryover once threshold reached", () => {
	const metrics = getPointsSummaryMetrics({ points: 125, threshold: 100 });

	expect(metrics.progress).toBe(100);
	expect(metrics.pointsToGo).toBe(0);
	expect(metrics.rewardsAvailable).toBe(1);
	expect(metrics.carryoverPoints).toBe(25);
	expect(metrics.nextRewardProgress).toBe(25);
	expect(metrics.nextRewardPointsToGo).toBe(75);
	expect(metrics.canClaim).toBe(true);
	expect(metrics.showCarryover).toBe(true);
});

test("handles zero threshold safely", () => {
	const metrics = getPointsSummaryMetrics({ points: 50, threshold: 0 });

	expect(metrics.progress).toBe(100);
	expect(metrics.pointsToGo).toBe(0);
	expect(metrics.rewardsAvailable).toBe(0);
	expect(metrics.carryoverPoints).toBe(0);
	expect(metrics.nextRewardProgress).toBe(0);
	expect(metrics.nextRewardPointsToGo).toBe(0);
	expect(metrics.canClaim).toBe(true);
	expect(metrics.showCarryover).toBe(false);
});

test("handles negative threshold safely", () => {
	const metrics = getPointsSummaryMetrics({ points: 50, threshold: -10 });

	expect(metrics.progress).toBe(100);
	expect(metrics.pointsToGo).toBe(0);
	expect(metrics.rewardsAvailable).toBe(0);
	expect(metrics.carryoverPoints).toBe(0);
	expect(metrics.nextRewardProgress).toBe(0);
	expect(metrics.nextRewardPointsToGo).toBe(0);
	expect(metrics.canClaim).toBe(true);
	expect(metrics.showCarryover).toBe(false);
});

test("clamps negative points with negative threshold", () => {
	const metrics = getPointsSummaryMetrics({ points: -5, threshold: -10 });

	expect(metrics.progress).toBe(100);
	expect(metrics.pointsToGo).toBe(0);
	expect(metrics.rewardsAvailable).toBe(0);
	expect(metrics.carryoverPoints).toBe(0);
	expect(metrics.nextRewardProgress).toBe(0);
	expect(metrics.nextRewardPointsToGo).toBe(0);
	expect(metrics.canClaim).toBe(true);
	expect(metrics.showCarryover).toBe(false);
});

test("handles exact threshold as a claimable reward", () => {
	const metrics = getPointsSummaryMetrics({ points: 100, threshold: 100 });

	expect(metrics.progress).toBe(100);
	expect(metrics.pointsToGo).toBe(0);
	expect(metrics.rewardsAvailable).toBe(1);
	expect(metrics.carryoverPoints).toBe(0);
	expect(metrics.nextRewardProgress).toBe(0);
	expect(metrics.nextRewardPointsToGo).toBe(100);
	expect(metrics.canClaim).toBe(true);
	expect(metrics.showCarryover).toBe(true);
});

test("computes carryover after multiple rewards", () => {
	const metrics = getPointsSummaryMetrics({ points: 250, threshold: 100 });

	expect(metrics.progress).toBe(100);
	expect(metrics.pointsToGo).toBe(0);
	expect(metrics.rewardsAvailable).toBe(2);
	expect(metrics.carryoverPoints).toBe(50);
	expect(metrics.nextRewardProgress).toBe(50);
	expect(metrics.nextRewardPointsToGo).toBe(50);
	expect(metrics.canClaim).toBe(true);
	expect(metrics.showCarryover).toBe(true);
});

test("rounds progress to the nearest whole percent", () => {
	const low = getPointsSummaryMetrics({ points: 1, threshold: 3 });
	const high = getPointsSummaryMetrics({ points: 2, threshold: 3 });

	expect(low.progress).toBe(33);
	expect(high.progress).toBe(67);
});
