import type { LeaderboardEntry } from "@/components/Leaderboard";

type PointSum = {
	userId: string;
	_sum: { points: number | null };
};

type CountSum = {
	userId: string;
	_count: { _all: number };
};

type LastActivity = {
	userId: string;
	_max: { createdAt: Date | null };
};

type UserSummary = {
	id: string;
	name: string | null;
	email: string | null;
};

type LeaderboardSummary = {
	entries: LeaderboardEntry[];
	myPoints: number;
	myTasks: number;
	myClaims: number;
};

export function buildLeaderboardSummary({
	userId,
	users,
	pointSums,
	earnedPointSums,
	taskCounts,
	rewardCounts,
	lastActivity,
}: {
	userId: string;
	users: UserSummary[];
	pointSums: PointSum[];
	earnedPointSums: PointSum[];
	taskCounts: CountSum[];
	rewardCounts: CountSum[];
	lastActivity: LastActivity[];
}): LeaderboardSummary {
	const netPointSumMap = new Map(
		pointSums.map((item) => [item.userId, item._sum.points ?? 0]),
	);
	const earnedPointSumMap = new Map(
		earnedPointSums.map((item) => [item.userId, item._sum.points ?? 0]),
	);
	const taskCountMap = new Map(
		taskCounts.map((item) => [item.userId, item._count._all]),
	);
	const rewardCountMap = new Map(
		rewardCounts.map((item) => [item.userId, item._count._all]),
	);
	const lastActivityMap = new Map(
		lastActivity.map((item) => [
			item.userId,
			item._max.createdAt?.toISOString() ?? null,
		]),
	);

	const rankedEntries = users
		.map((user) => ({
			userId: user.id,
			name: user.name ?? user.email ?? "Unknown user",
			email: user.email,
			points: earnedPointSumMap.get(user.id) ?? 0,
			currentBalance: netPointSumMap.get(user.id) ?? 0,
			tasks: taskCountMap.get(user.id) ?? 0,
			claims: rewardCountMap.get(user.id) ?? 0,
			lastActivity: lastActivityMap.get(user.id),
		}))
		.sort(
			(a, b) =>
				b.points - a.points ||
				b.currentBalance - a.currentBalance ||
				a.name.localeCompare(b.name),
		);

	return {
		entries: rankedEntries,
		myPoints: netPointSumMap.get(userId) ?? 0,
		myTasks: taskCountMap.get(userId) ?? 0,
		myClaims: rewardCountMap.get(userId) ?? 0,
	};
}
