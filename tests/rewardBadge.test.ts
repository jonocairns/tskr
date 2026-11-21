import { getRewardBadgeState } from "../src/lib/rewardBadge";

describe("getRewardBadgeState", () => {
	test("shows progress below the threshold", () => {
		expect(getRewardBadgeState({ points: 38, threshold: 50, claimsRemaining: null })).toEqual({
			kind: "progress",
			meterPoints: 38,
			progress: 76,
		});
	});

	test("clamps progress for a negative balance", () => {
		expect(getRewardBadgeState({ points: -10, threshold: 50, claimsRemaining: null })).toEqual({
			kind: "progress",
			meterPoints: -10,
			progress: 0,
		});
	});

	test("is ready at the threshold and starts the next reward from zero", () => {
		expect(getRewardBadgeState({ points: 50, threshold: 50, claimsRemaining: null })).toEqual({
			kind: "ready",
			count: 1,
			meterPoints: 0,
			progress: 0,
		});
	});

	test("counts towards the next reward once one is ready", () => {
		expect(getRewardBadgeState({ points: 63, threshold: 50, claimsRemaining: null })).toEqual({
			kind: "ready",
			count: 1,
			meterPoints: 13,
			progress: 26,
		});
	});

	test("counts banked rewards", () => {
		expect(getRewardBadgeState({ points: 108, threshold: 50, claimsRemaining: null })).toEqual({
			kind: "ready",
			count: 2,
			meterPoints: 8,
			progress: 16,
		});
	});

	test("caps ready rewards at the remaining claim allowance", () => {
		expect(getRewardBadgeState({ points: 160, threshold: 50, claimsRemaining: 1 })).toEqual({
			kind: "ready",
			count: 1,
			meterPoints: 10,
			progress: 20,
		});
	});

	test("does not let a larger allowance invent rewards", () => {
		expect(getRewardBadgeState({ points: 60, threshold: 50, claimsRemaining: 5 })).toMatchObject({
			kind: "ready",
			count: 1,
		});
	});

	test("is paused when no claims remain but still counts towards the next reward", () => {
		expect(getRewardBadgeState({ points: 55, threshold: 50, claimsRemaining: 0 })).toEqual({
			kind: "limited",
			meterPoints: 5,
			progress: 10,
		});
	});

	test("pauses with several rewards banked and keeps the carryover", () => {
		expect(getRewardBadgeState({ points: 160, threshold: 50, claimsRemaining: 0 })).toEqual({
			kind: "limited",
			meterPoints: 10,
			progress: 20,
		});
	});

	test("starts the next reward from zero at an exact multiple", () => {
		expect(getRewardBadgeState({ points: 100, threshold: 50, claimsRemaining: null })).toEqual({
			kind: "ready",
			count: 2,
			meterPoints: 0,
			progress: 0,
		});
	});

	test("reports rounded carryover progress for the ring to cap", () => {
		expect(getRewardBadgeState({ points: 999, threshold: 500, claimsRemaining: null })).toEqual({
			kind: "ready",
			count: 1,
			meterPoints: 499,
			progress: 100,
		});
	});

	test("never treats a non-positive threshold as claimable", () => {
		expect(getRewardBadgeState({ points: 10, threshold: 0, claimsRemaining: 0 })).toMatchObject({ kind: "progress" });
	});

	test("ignores an exhausted allowance below the threshold", () => {
		expect(getRewardBadgeState({ points: 20, threshold: 50, claimsRemaining: 0 })).toMatchObject({
			kind: "progress",
		});
	});
});
