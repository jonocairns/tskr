import { getPointsSummaryMetrics } from "../src/lib/pointsSummary";

describe("getPointsSummaryMetrics", () => {
	describe("basic functionality", () => {
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
	});

	describe("edge cases: zero and negative values", () => {
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

		test("handles zero points with valid threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 0, threshold: 100 });

			expect(metrics.progress).toBe(0);
			expect(metrics.pointsToGo).toBe(100);
			expect(metrics.rewardsAvailable).toBe(0);
			expect(metrics.carryoverPoints).toBe(0);
			expect(metrics.nextRewardProgress).toBe(0);
			expect(metrics.nextRewardPointsToGo).toBe(100);
			expect(metrics.canClaim).toBe(false);
			expect(metrics.showCarryover).toBe(false);
		});

		test("handles zero points and zero threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 0, threshold: 0 });

			expect(metrics.progress).toBe(100);
			expect(metrics.pointsToGo).toBe(0);
			expect(metrics.rewardsAvailable).toBe(0);
			expect(metrics.carryoverPoints).toBe(0);
			expect(metrics.nextRewardProgress).toBe(0);
			expect(metrics.nextRewardPointsToGo).toBe(0);
			expect(metrics.canClaim).toBe(true);
			expect(metrics.showCarryover).toBe(false);
		});

		test("handles negative points with valid threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: -50, threshold: 100 });

			expect(metrics.progress).toBe(0);
			expect(metrics.pointsToGo).toBe(150);
			expect(metrics.rewardsAvailable).toBe(-1);
			expect(metrics.carryoverPoints).toBe(-50);
			expect(metrics.nextRewardProgress).toBe(-50);
			expect(metrics.nextRewardPointsToGo).toBe(150);
			expect(metrics.canClaim).toBe(false);
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
	});

	describe("progress calculation and rounding", () => {
		test("rounds progress to the nearest whole percent", () => {
			const low = getPointsSummaryMetrics({ points: 1, threshold: 3 });
			const high = getPointsSummaryMetrics({ points: 2, threshold: 3 });

			expect(low.progress).toBe(33);
			expect(high.progress).toBe(67);
		});

		test("rounds 0.5% down to 0%", () => {
			const metrics = getPointsSummaryMetrics({ points: 1, threshold: 200 });
			expect(metrics.progress).toBe(1);
		});

		test("rounds 99.5% up to 100%", () => {
			const metrics = getPointsSummaryMetrics({ points: 199, threshold: 200 });
			expect(metrics.progress).toBe(100);
		});

		test("clamps progress at 100% when points exceed threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 500, threshold: 100 });
			expect(metrics.progress).toBe(100);
		});

		test("clamps progress at 0% when points are negative", () => {
			const metrics = getPointsSummaryMetrics({ points: -100, threshold: 100 });
			expect(metrics.progress).toBe(0);
		});

		test("handles very small progress percentages", () => {
			const metrics = getPointsSummaryMetrics({ points: 1, threshold: 1000 });
			expect(metrics.progress).toBe(0);
		});

		test("handles fractional points with rounding", () => {
			const metrics = getPointsSummaryMetrics({ points: 33.3333, threshold: 100 });
			expect(metrics.progress).toBe(33);
		});
	});

	describe("rewards calculation", () => {
		test("calculates multiple rewards correctly", () => {
			const metrics = getPointsSummaryMetrics({ points: 355, threshold: 100 });
			expect(metrics.rewardsAvailable).toBe(3);
		});

		test("handles large numbers of rewards", () => {
			const metrics = getPointsSummaryMetrics({ points: 10000, threshold: 50 });
			expect(metrics.rewardsAvailable).toBe(200);
		});

		test("handles fractional reward calculation", () => {
			const metrics = getPointsSummaryMetrics({ points: 249, threshold: 100 });
			expect(metrics.rewardsAvailable).toBe(2);
			expect(metrics.carryoverPoints).toBe(49);
		});

		test("returns 0 rewards when below threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 99, threshold: 100 });
			expect(metrics.rewardsAvailable).toBe(0);
		});

		test("returns 0 rewards when threshold is invalid", () => {
			const metrics = getPointsSummaryMetrics({ points: 500, threshold: 0 });
			expect(metrics.rewardsAvailable).toBe(0);
		});
	});

	describe("carryover points calculation", () => {
		test("calculates carryover for points just above threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 101, threshold: 100 });
			expect(metrics.carryoverPoints).toBe(1);
		});

		test("carryover resets to zero at exact threshold multiples", () => {
			const metrics = getPointsSummaryMetrics({ points: 300, threshold: 100 });
			expect(metrics.carryoverPoints).toBe(0);
		});

		test("carryover equals points when below threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 75, threshold: 100 });
			expect(metrics.carryoverPoints).toBe(75);
		});

		test("handles carryover with fractional points", () => {
			const metrics = getPointsSummaryMetrics({ points: 234.56, threshold: 100 });
			expect(metrics.carryoverPoints).toBeCloseTo(34.56, 2);
		});
	});

	describe("next reward progress", () => {
		test("calculates next reward progress correctly", () => {
			const metrics = getPointsSummaryMetrics({ points: 225, threshold: 100 });
			expect(metrics.nextRewardProgress).toBe(25);
			expect(metrics.nextRewardPointsToGo).toBe(75);
		});

		test("next reward progress is zero at threshold multiples", () => {
			const metrics = getPointsSummaryMetrics({ points: 200, threshold: 100 });
			expect(metrics.nextRewardProgress).toBe(0);
			expect(metrics.nextRewardPointsToGo).toBe(100);
		});

		test("next reward progress matches overall progress when no rewards claimed", () => {
			const metrics = getPointsSummaryMetrics({ points: 45, threshold: 100 });
			expect(metrics.nextRewardProgress).toBe(metrics.progress);
			expect(metrics.nextRewardPointsToGo).toBe(metrics.pointsToGo);
		});
	});

	describe("canClaim flag", () => {
		test("canClaim is true when points equal threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 100, threshold: 100 });
			expect(metrics.canClaim).toBe(true);
		});

		test("canClaim is true when points exceed threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 150, threshold: 100 });
			expect(metrics.canClaim).toBe(true);
		});

		test("canClaim is false when points below threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 99, threshold: 100 });
			expect(metrics.canClaim).toBe(false);
		});

		test("canClaim is true when threshold is zero or negative", () => {
			const zero = getPointsSummaryMetrics({ points: 50, threshold: 0 });
			const negative = getPointsSummaryMetrics({ points: 50, threshold: -10 });
			expect(zero.canClaim).toBe(true);
			expect(negative.canClaim).toBe(true);
		});

		test("canClaim is false when points are negative with valid threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: -10, threshold: 100 });
			expect(metrics.canClaim).toBe(false);
		});
	});

	describe("showCarryover flag", () => {
		test("showCarryover is true when can claim and has valid threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 125, threshold: 100 });
			expect(metrics.showCarryover).toBe(true);
		});

		test("showCarryover is false when cannot claim", () => {
			const metrics = getPointsSummaryMetrics({ points: 75, threshold: 100 });
			expect(metrics.showCarryover).toBe(false);
		});

		test("showCarryover is false when threshold is invalid", () => {
			const zero = getPointsSummaryMetrics({ points: 50, threshold: 0 });
			const negative = getPointsSummaryMetrics({ points: 50, threshold: -10 });
			expect(zero.showCarryover).toBe(false);
			expect(negative.showCarryover).toBe(false);
		});

		test("showCarryover is true at exact threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 100, threshold: 100 });
			expect(metrics.showCarryover).toBe(true);
		});
	});

	describe("large numbers and boundary conditions", () => {
		test("handles very large point values", () => {
			const metrics = getPointsSummaryMetrics({ points: 1_000_000, threshold: 1000 });
			expect(metrics.rewardsAvailable).toBe(1000);
			expect(metrics.progress).toBe(100);
		});

		test("handles very large threshold values", () => {
			const metrics = getPointsSummaryMetrics({ points: 500, threshold: 1_000_000 });
			expect(metrics.progress).toBe(0);
			expect(metrics.pointsToGo).toBe(999_500);
		});

		test("handles very small threshold values", () => {
			const metrics = getPointsSummaryMetrics({ points: 100, threshold: 1 });
			expect(metrics.rewardsAvailable).toBe(100);
			expect(metrics.carryoverPoints).toBe(0);
		});

		test("handles floating point precision for large numbers", () => {
			const metrics = getPointsSummaryMetrics({ points: 999_999.99, threshold: 1000 });
			expect(metrics.rewardsAvailable).toBe(999);
		});
	});

	describe("pointsToGo calculation", () => {
		test("calculates pointsToGo correctly when below threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 30, threshold: 100 });
			expect(metrics.pointsToGo).toBe(70);
		});

		test("pointsToGo is zero when at or above threshold", () => {
			const atThreshold = getPointsSummaryMetrics({ points: 100, threshold: 100 });
			const aboveThreshold = getPointsSummaryMetrics({ points: 150, threshold: 100 });
			expect(atThreshold.pointsToGo).toBe(0);
			expect(aboveThreshold.pointsToGo).toBe(0);
		});

		test("pointsToGo never goes negative", () => {
			const metrics = getPointsSummaryMetrics({ points: 500, threshold: 100 });
			expect(metrics.pointsToGo).toBe(0);
		});

		test("pointsToGo is zero when threshold is invalid", () => {
			const metrics = getPointsSummaryMetrics({ points: 50, threshold: 0 });
			expect(metrics.pointsToGo).toBe(0);
		});
	});

	describe("real-world scenarios", () => {
		test("scenario: user just starting out", () => {
			const metrics = getPointsSummaryMetrics({ points: 0, threshold: 100 });
			expect(metrics).toEqual({
				progress: 0,
				pointsToGo: 100,
				rewardsAvailable: 0,
				carryoverPoints: 0,
				nextRewardProgress: 0,
				nextRewardPointsToGo: 100,
				canClaim: false,
				showCarryover: false,
			});
		});

		test("scenario: user halfway to first reward", () => {
			const metrics = getPointsSummaryMetrics({ points: 50, threshold: 100 });
			expect(metrics).toEqual({
				progress: 50,
				pointsToGo: 50,
				rewardsAvailable: 0,
				carryoverPoints: 50,
				nextRewardProgress: 50,
				nextRewardPointsToGo: 50,
				canClaim: false,
				showCarryover: false,
			});
		});

		test("scenario: user just earned first reward", () => {
			const metrics = getPointsSummaryMetrics({ points: 100, threshold: 100 });
			expect(metrics).toEqual({
				progress: 100,
				pointsToGo: 0,
				rewardsAvailable: 1,
				carryoverPoints: 0,
				nextRewardProgress: 0,
				nextRewardPointsToGo: 100,
				canClaim: true,
				showCarryover: true,
			});
		});

		test("scenario: power user with many unclaimed rewards", () => {
			const metrics = getPointsSummaryMetrics({ points: 873, threshold: 100 });
			expect(metrics).toEqual({
				progress: 100,
				pointsToGo: 0,
				rewardsAvailable: 8,
				carryoverPoints: 73,
				nextRewardProgress: 73,
				nextRewardPointsToGo: 27,
				canClaim: true,
				showCarryover: true,
			});
		});
	});
});
