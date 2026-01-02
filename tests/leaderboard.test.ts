import { buildLeaderboardSummary } from "../src/lib/dashboard/leaderboard";

const makeSummaryInput = () => {
	const users = [
		{ id: "u1", name: "Zed", email: "zed@example.com" },
		{ id: "u2", name: null, email: "amy@example.com" },
		{ id: "u3", name: "Aaron", email: "aaron@example.com" },
		{ id: "u4", name: null, email: null },
	];

	return {
		userId: "u1",
		users,
		pointSums: [
			{ userId: "u1", _sum: { points: 50 } },
			{ userId: "u2", _sum: { points: 60 } },
			{ userId: "u3", _sum: { points: 50 } },
		],
		earnedPointSums: [
			{ userId: "u1", _sum: { points: 10 } },
			{ userId: "u2", _sum: { points: 10 } },
			{ userId: "u3", _sum: { points: 10 } },
		],
		taskCounts: [
			{ userId: "u1", _count: { _all: 3 } },
			{ userId: "u2", _count: { _all: 2 } },
			{ userId: "u3", _count: { _all: 2 } },
		],
		rewardCounts: [
			{ userId: "u1", _count: { _all: 2 } },
			{ userId: "u2", _count: { _all: 0 } },
			{ userId: "u3", _count: { _all: 1 } },
		],
		lastActivity: [
			{ userId: "u1", _max: { createdAt: new Date("2024-01-02T03:04:05.000Z") } },
			{ userId: "u4", _max: { createdAt: null } },
		],
		firstActivity: [
			{ userId: "u1", _min: { createdAt: new Date("2024-01-01T00:00:00.000Z") } },
			{ userId: "u2", _min: { createdAt: new Date("2024-01-01T00:00:00.000Z") } },
			{ userId: "u3", _min: { createdAt: new Date("2024-01-01T00:00:00.000Z") } },
		],
	};
};

test("sorts by average points per day, then points, balance, and name with fallbacks", () => {
	const summary = buildLeaderboardSummary(makeSummaryInput());

	expect(summary.entries.map((entry) => entry.userId)).toEqual(["u2", "u3", "u1", "u4"]);
	expect(summary.entries[0]?.name).toBe("amy@example.com");
});

test("defaults missing sums, formats activity, calculates average, and returns my totals", () => {
	const summary = buildLeaderboardSummary(makeSummaryInput());
	const unknown = summary.entries.find((entry) => entry.userId === "u4");
	const zed = summary.entries.find((entry) => entry.userId === "u1");

	expect(unknown?.name).toBe("Unknown user");
	expect(unknown?.points).toBe(0);
	expect(unknown?.currentBalance).toBe(0);
	expect(unknown?.tasks).toBe(0);
	expect(unknown?.claims).toBe(0);
	expect(unknown?.lastActivity).toBeNull();
	expect(unknown?.averagePointsPerDay).toBe(0);
	expect(zed?.lastActivity).toBe("2024-01-02T03:04:05.000Z");
	expect(zed?.averagePointsPerDay).toBeGreaterThan(0);

	expect(summary.myPoints).toBe(50);
	expect(summary.myTasks).toBe(3);
	expect(summary.myClaims).toBe(2);
});
