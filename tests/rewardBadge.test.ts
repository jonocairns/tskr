import { getRewardBadgeState } from "../src/lib/rewardBadge";

describe("getRewardBadgeState", () => {
	test("shows progress below the threshold", () => {
		expect(getRewardBadgeState({ points: 38, threshold: 50, claimsRemaining: null })).toEqual({
			kind: "progress",
			points: 38,
			threshold: 50,
			progress: 76,
		});
	});

	test("clamps progress for a negative balance", () => {
		expect(getRewardBadgeState({ points: -10, threshold: 50, claimsRemaining: null })).toMatchObject({
			kind: "progress",
			points: -10,
			progress: 0,
		});
	});

	test("is ready at the threshold without claim limits", () => {
		expect(getRewardBadgeState({ points: 50, threshold: 50, claimsRemaining: null })).toEqual({
			kind: "ready",
			count: 1,
		});
	});

	test("counts banked rewards", () => {
		expect(getRewardBadgeState({ points: 108, threshold: 50, claimsRemaining: null })).toEqual({
			kind: "ready",
			count: 2,
		});
	});

	test("caps ready rewards at the remaining claim allowance", () => {
		expect(getRewardBadgeState({ points: 160, threshold: 50, claimsRemaining: 1 })).toEqual({
			kind: "ready",
			count: 1,
		});
	});

	test("does not let a larger allowance invent rewards", () => {
		expect(getRewardBadgeState({ points: 60, threshold: 50, claimsRemaining: 5 })).toEqual({
			kind: "ready",
			count: 1,
		});
	});

	test("is limited when no claims remain", () => {
		expect(getRewardBadgeState({ points: 55, threshold: 50, claimsRemaining: 0 })).toEqual({
			kind: "limited",
			points: 55,
		});
	});

	test("ignores an exhausted allowance below the threshold", () => {
		expect(getRewardBadgeState({ points: 20, threshold: 50, claimsRemaining: 0 })).toMatchObject({
			kind: "progress",
		});
	});
});
