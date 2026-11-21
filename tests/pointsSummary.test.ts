import { getBarEdgeColors, getClaimStatus, getPointsSummaryMetrics, getRulePlacement } from "../src/lib/pointsSummary";

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

	describe("extreme edge cases: Infinity and NaN", () => {
		test("handles Infinity points with valid threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: Number.POSITIVE_INFINITY, threshold: 100 });
			expect(metrics.progress).toBe(100);
			expect(metrics.pointsToGo).toBe(0);
			expect(metrics.rewardsAvailable).toBe(Number.POSITIVE_INFINITY);
			expect(metrics.carryoverPoints).toBeNaN();
			expect(metrics.canClaim).toBe(true);
		});

		test("handles negative Infinity points with valid threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: Number.NEGATIVE_INFINITY, threshold: 100 });
			expect(metrics.progress).toBe(0);
			expect(metrics.pointsToGo).toBe(Number.POSITIVE_INFINITY);
			expect(metrics.rewardsAvailable).toBe(Number.NEGATIVE_INFINITY);
			expect(metrics.carryoverPoints).toBeNaN();
			expect(metrics.canClaim).toBe(false);
		});

		test("handles valid points with Infinity threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 100, threshold: Number.POSITIVE_INFINITY });
			expect(metrics.progress).toBe(0);
			expect(metrics.pointsToGo).toBe(Number.POSITIVE_INFINITY);
			expect(metrics.rewardsAvailable).toBe(0);
			expect(metrics.carryoverPoints).toBe(100);
			expect(metrics.canClaim).toBe(false);
		});

		test("handles Infinity points with Infinity threshold", () => {
			const metrics = getPointsSummaryMetrics({
				points: Number.POSITIVE_INFINITY,
				threshold: Number.POSITIVE_INFINITY,
			});
			expect(metrics.progress).toBeNaN();
			expect(metrics.pointsToGo).toBeNaN();
			expect(metrics.rewardsAvailable).toBeNaN();
			expect(metrics.carryoverPoints).toBeNaN();
			expect(metrics.canClaim).toBe(true);
		});

		test("handles NaN points with valid threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: Number.NaN, threshold: 100 });
			expect(metrics.progress).toBeNaN();
			expect(metrics.pointsToGo).toBeNaN();
			expect(metrics.rewardsAvailable).toBeNaN();
			expect(metrics.carryoverPoints).toBeNaN();
			expect(metrics.canClaim).toBe(false);
		});

		test("handles valid points with NaN threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 100, threshold: Number.NaN });
			expect(metrics.progress).toBe(100);
			expect(metrics.pointsToGo).toBe(0);
			expect(metrics.rewardsAvailable).toBe(0);
			expect(metrics.carryoverPoints).toBe(0);
			expect(metrics.canClaim).toBe(false);
		});

		test("handles NaN points with NaN threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: Number.NaN, threshold: Number.NaN });
			expect(metrics.progress).toBe(100);
			expect(metrics.pointsToGo).toBe(0);
			expect(metrics.rewardsAvailable).toBe(0);
			expect(metrics.carryoverPoints).toBe(0);
			expect(metrics.canClaim).toBe(false); // NaN >= NaN is false
		});
	});

	describe("floating point precision edge cases", () => {
		test("handles very small positive threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 1, threshold: 0.0001 });
			expect(metrics.rewardsAvailable).toBe(10000);
			expect(metrics.progress).toBe(100);
		});

		test("handles very small decimal points", () => {
			const metrics = getPointsSummaryMetrics({ points: 0.0001, threshold: 100 });
			expect(metrics.progress).toBe(0); // Rounds to 0%
			expect(metrics.pointsToGo).toBeCloseTo(99.9999, 4);
		});

		test("handles floating point arithmetic edge case", () => {
			const metrics = getPointsSummaryMetrics({ points: 0.1 + 0.2, threshold: 1 });
			expect(metrics.progress).toBe(30);
			expect(metrics.carryoverPoints).toBeCloseTo(0.3, 10);
		});

		test("handles modulo with decimal threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 10.5, threshold: 3.3 });
			expect(metrics.rewardsAvailable).toBe(3);
			expect(metrics.carryoverPoints).toBeCloseTo(0.6, 1);
		});

		test("handles very large numbers near MAX_SAFE_INTEGER", () => {
			const nearMax = Number.MAX_SAFE_INTEGER - 1;
			const metrics = getPointsSummaryMetrics({ points: nearMax, threshold: 1000 });
			expect(metrics.rewardsAvailable).toBeGreaterThan(0);
			expect(Number.isFinite(metrics.rewardsAvailable)).toBe(true);
		});

		test("handles very small numbers near MIN_VALUE", () => {
			const metrics = getPointsSummaryMetrics({ points: Number.MIN_VALUE, threshold: 100 });
			expect(metrics.progress).toBe(0);
			expect(metrics.rewardsAvailable).toBe(0);
			expect(metrics.pointsToGo).toBeCloseTo(100, 10);
		});

		test("handles denormalized numbers", () => {
			const tiny = Number.MIN_VALUE * 2;
			const metrics = getPointsSummaryMetrics({ points: tiny, threshold: 100 });
			expect(metrics.progress).toBe(0);
			expect(metrics.pointsToGo).toBeCloseTo(100, 50);
		});

		test("handles rounding near 0.5 boundaries", () => {
			// Test Math.round behavior at exact 0.5
			const metrics1 = getPointsSummaryMetrics({ points: 50.4999, threshold: 100 });
			const metrics2 = getPointsSummaryMetrics({ points: 50.5, threshold: 100 });

			expect(metrics1.progress).toBe(50);
			expect(metrics2.progress).toBe(51); // Math.round rounds 0.5 up
		});
	});

	describe("division and modulo edge cases", () => {
		test("handles threshold of 1 correctly", () => {
			const metrics = getPointsSummaryMetrics({ points: 7, threshold: 1 });
			expect(metrics.rewardsAvailable).toBe(7);
			expect(metrics.carryoverPoints).toBe(0);
			expect(metrics.progress).toBe(100);
		});

		test("handles fractional threshold division", () => {
			const metrics = getPointsSummaryMetrics({ points: 10, threshold: 3 });
			expect(metrics.rewardsAvailable).toBe(3);
			expect(metrics.carryoverPoints).toBe(1); // 10 % 3 = 1
			expect(metrics.nextRewardProgress).toBe(33);
		});

		test("handles negative modulo correctly", () => {
			const metrics = getPointsSummaryMetrics({ points: -7, threshold: 3 });
			expect(metrics.carryoverPoints).toBe(-1);
			expect(metrics.rewardsAvailable).toBe(-3);
		});

		test("handles threshold just above zero", () => {
			const metrics = getPointsSummaryMetrics({ points: 100, threshold: 0.1 });
			expect(metrics.rewardsAvailable).toBe(1000);
			expect(metrics.progress).toBe(100);
		});

		test("handles points just below threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 99.999, threshold: 100 });
			expect(metrics.progress).toBe(100); // Rounds to 100%
			expect(metrics.rewardsAvailable).toBe(0);
			expect(metrics.canClaim).toBe(false);
		});

		test("handles points just above threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 100.001, threshold: 100 });
			expect(metrics.progress).toBe(100);
			expect(metrics.rewardsAvailable).toBe(1);
			expect(metrics.canClaim).toBe(true);
			expect(metrics.carryoverPoints).toBeCloseTo(0.001, 3);
		});
	});

	describe("progress percentage edge cases", () => {
		test("handles progress exactly at 0.5%", () => {
			const metrics = getPointsSummaryMetrics({ points: 0.5, threshold: 100 });
			expect(metrics.progress).toBe(1);
		});

		test("handles progress exactly at 99.5%", () => {
			const metrics = getPointsSummaryMetrics({ points: 99.5, threshold: 100 });
			expect(metrics.progress).toBe(100);
		});

		test("handles progress at 100.5% (should clamp to 100%)", () => {
			const metrics = getPointsSummaryMetrics({ points: 100.5, threshold: 100 });
			expect(metrics.progress).toBe(100);
		});

		test("handles progress calculation with very large ratio", () => {
			const metrics = getPointsSummaryMetrics({ points: 1_000_000, threshold: 1 });
			expect(metrics.progress).toBe(100); // Should be clamped
		});

		test("handles progress calculation with very small ratio", () => {
			const metrics = getPointsSummaryMetrics({ points: 1, threshold: 1_000_000 });
			expect(metrics.progress).toBe(0);
		});
	});

	describe("nextRewardPointsToGo edge cases", () => {
		test("nextRewardPointsToGo never goes negative with excess points", () => {
			const metrics = getPointsSummaryMetrics({ points: 199, threshold: 100 });
			expect(metrics.nextRewardPointsToGo).toBe(1);
			expect(metrics.nextRewardPointsToGo).toBeGreaterThanOrEqual(0);
		});

		test("nextRewardPointsToGo at exact threshold multiple", () => {
			const metrics = getPointsSummaryMetrics({ points: 500, threshold: 100 });
			expect(metrics.nextRewardPointsToGo).toBe(100);
			expect(metrics.carryoverPoints).toBe(0);
		});

		test("nextRewardPointsToGo with fractional carryover", () => {
			const metrics = getPointsSummaryMetrics({ points: 123.456, threshold: 100 });
			expect(metrics.nextRewardPointsToGo).toBeCloseTo(76.544, 3);
		});
	});

	describe("consistency checks", () => {
		test("progress and pointsToGo should sum correctly", () => {
			const metrics = getPointsSummaryMetrics({ points: 45, threshold: 100 });
			const progressPoints = (metrics.progress / 100) * 100;
			expect(progressPoints + metrics.pointsToGo).toBeCloseTo(100, 0);
		});

		test("carryoverPoints should always be less than threshold", () => {
			const metrics = getPointsSummaryMetrics({ points: 175, threshold: 100 });
			expect(metrics.carryoverPoints).toBeLessThan(100);
			expect(metrics.carryoverPoints).toBeGreaterThanOrEqual(0);
		});

		test("rewardsAvailable matches floor division", () => {
			const points = 273;
			const threshold = 50;
			const metrics = getPointsSummaryMetrics({ points, threshold });
			expect(metrics.rewardsAvailable).toBe(Math.floor(points / threshold));
		});

		test("canClaim consistency with rewardsAvailable", () => {
			const canClaim = getPointsSummaryMetrics({ points: 100, threshold: 100 });
			const cannotClaim = getPointsSummaryMetrics({ points: 99, threshold: 100 });

			expect(canClaim.canClaim).toBe(true);
			expect(canClaim.rewardsAvailable).toBeGreaterThanOrEqual(1);

			expect(cannotClaim.canClaim).toBe(false);
			expect(cannotClaim.rewardsAvailable).toBe(0);
		});

		test("showCarryover only true when both canClaim and hasValidThreshold", () => {
			const valid = getPointsSummaryMetrics({ points: 150, threshold: 100 });
			const noThreshold = getPointsSummaryMetrics({ points: 150, threshold: 0 });
			const noClaim = getPointsSummaryMetrics({ points: 50, threshold: 100 });

			expect(valid.showCarryover).toBe(true);
			expect(noThreshold.showCarryover).toBe(false);
			expect(noClaim.showCarryover).toBe(false);
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

describe("getClaimStatus", () => {
	const rule = (id: string, remaining: number, changesAt: string | null) => ({ id, remaining, changesAt });

	test("without limits every earned reward is claimable", () => {
		expect(getClaimStatus({ rewardsAvailable: 3, allowance: null })).toEqual({
			blockingRuleIds: [],
			limitingRuleId: null,
			limitReached: false,
			resumesAt: null,
			claimableRewards: 3,
		});
	});

	test("caps claimable rewards at the remaining allowance", () => {
		const status = getClaimStatus({
			rewardsAvailable: 5,
			allowance: { remaining: 2, rules: [rule("week", 2, "2026-11-23T11:00:00.000Z")] },
		});

		expect(status.claimableRewards).toBe(2);
		expect(status.limitingRuleId).toBe("week");
		expect(status.limitReached).toBe(false);
		expect(status.resumesAt).toBeNull();
	});

	test("resumes when the last blocking rule frees a slot, ignoring earlier non-blocking changes", () => {
		const status = getClaimStatus({
			rewardsAvailable: 9,
			allowance: {
				remaining: 0,
				rules: [
					rule("week", 3, "2026-11-22T11:00:00.000Z"),
					rule("day", 0, "2026-11-21T11:00:00.000Z"),
					rule("month", 0, "2026-11-30T11:00:00.000Z"),
				],
			},
		});

		expect(status).toEqual({
			// The month rule sets the resume time, so it leads.
			blockingRuleIds: ["month", "day"],
			limitingRuleId: "day",
			limitReached: true,
			resumesAt: "2026-11-30T11:00:00.000Z",
			claimableRewards: 0,
		});
	});

	test("leaves the resume time unknown when a blocking rule has no next allowance", () => {
		const status = getClaimStatus({
			rewardsAvailable: 1,
			allowance: {
				remaining: 0,
				rules: [rule("day", 0, "2026-11-21T11:00:00.000Z"), rule("rolling", 0, null)],
			},
		});

		expect(status.limitReached).toBe(true);
		expect(status.resumesAt).toBeNull();
		expect(status.blockingRuleIds).toEqual(["rolling", "day"]);
	});

	test("picks the first rule with the least allowance as the limiting rule", () => {
		const status = getClaimStatus({
			rewardsAvailable: 4,
			allowance: {
				remaining: 2,
				rules: [rule("week", 4, null), rule("rolling", 2, null), rule("month", 2, null)],
			},
		});

		expect(status.limitingRuleId).toBe("rolling");
		expect(status.claimableRewards).toBe(2);
	});
});

describe("getRulePlacement", () => {
	const rules = ["day", "week", "month", "rolling"].map((id) => ({ id }));
	const ids = (list: { id: string }[]) => list.map((rule) => rule.id);

	test("a single rule shows inline without a disclosure", () => {
		const placement = getRulePlacement({ rules: [{ id: "week" }], blockingRuleIds: [], limitingRuleId: "week" });
		expect(ids(placement.inline)).toEqual(["week"]);
		expect(placement.hidden).toEqual([]);
	});

	test("a single blocking rule leaves nothing else to show", () => {
		const placement = getRulePlacement({ rules: [{ id: "day" }], blockingRuleIds: ["day"], limitingRuleId: "day" });
		expect(ids(placement.blocking)).toEqual(["day"]);
		expect(placement.inline).toEqual([]);
		expect(placement.hidden).toEqual([]);
	});

	test("never hides a lone rule behind a disclosure", () => {
		const unblocked = getRulePlacement({ rules: rules.slice(0, 2), blockingRuleIds: [], limitingRuleId: "week" });
		expect(ids(unblocked.inline)).toEqual(["week", "day"]);
		expect(unblocked.hidden).toEqual([]);

		const blocked = getRulePlacement({
			rules: rules.slice(0, 3),
			blockingRuleIds: ["week", "day"],
			limitingRuleId: "day",
		});
		expect(ids(blocked.blocking)).toEqual(["week", "day"]);
		expect(ids(blocked.inline)).toEqual(["month"]);
		expect(blocked.hidden).toEqual([]);
	});

	test("hides two or more rules without repeating the ones on screen", () => {
		const unblocked = getRulePlacement({ rules, blockingRuleIds: [], limitingRuleId: "month" });
		expect(ids(unblocked.inline)).toEqual(["month"]);
		expect(ids(unblocked.hidden)).toEqual(["day", "week", "rolling"]);

		const blocked = getRulePlacement({ rules, blockingRuleIds: ["day"], limitingRuleId: "day" });
		expect(ids(blocked.blocking)).toEqual(["day"]);
		expect(blocked.inline).toEqual([]);
		expect(ids(blocked.hidden)).toEqual(["week", "month", "rolling"]);
	});
});

describe("getBarEdgeColors", () => {
	test("adds a darker edge to light fills on light themes only", () => {
		const { light, dark } = getBarEdgeColors("#facc15");
		expect(light).toMatch(/^#[0-9a-f]{6}$/);
		expect(dark).toBeNull();
	});

	test("adds a lighter edge to dark fills on dark themes only", () => {
		const { light, dark } = getBarEdgeColors("#1e3a8a");
		expect(light).toBeNull();
		expect(dark).toMatch(/^#[0-9a-f]{6}$/);
	});

	test("ignores values that are not six-digit hex colours", () => {
		expect(getBarEdgeColors("red")).toEqual({ light: null, dark: null });
	});

	test("emitted edges reach 3:1 against the track after rounding", () => {
		const channel = (c: number) => {
			const v = c / 255;
			return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		};
		const lum = (hex: string) => {
			const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
			return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
		};
		const contrast = (a: string, b: string) => {
			const [high, low] = [lum(a), lum(b)].sort((x, y) => y - x);
			return (high + 0.05) / (low + 0.05);
		};
		// Mirrors the light (#d8d6d3) and dark (#39393a) tracks the helper measures against.
		for (const fill of ["#00177e", "#facc15", "#1e3a8a", "#22c55e"]) {
			const { light, dark } = getBarEdgeColors(fill);
			if (light) expect(contrast(light, "#d8d6d3")).toBeGreaterThanOrEqual(3);
			if (dark) expect(contrast(dark, "#39393a")).toBeGreaterThanOrEqual(3);
		}
	});
});
