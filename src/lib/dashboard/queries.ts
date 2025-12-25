import { prisma } from "@/lib/prisma";

export async function getDashboardData(userId: string) {
	const weekStart = new Date();
	weekStart.setDate(weekStart.getDate() - 7);

	const [
		pointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		users,
		recentLogs,
		presets,
		weeklyTaskCount,
		weeklyPointSum,
		taskLogDates,
	] = await Promise.all([
		prisma.pointLog.groupBy({
			by: ["userId"],
			where: { revertedAt: null },
			_sum: { points: true },
		}),
		prisma.pointLog.groupBy({
			by: ["userId"],
			where: {
				revertedAt: null,
				kind: { in: ["PRESET", "TIMED"] },
			},
			_count: { _all: true },
		}),
		prisma.pointLog.groupBy({
			by: ["userId"],
			where: { revertedAt: null, kind: "REWARD" },
			_count: { _all: true },
		}),
		prisma.pointLog.groupBy({
			by: ["userId"],
			_max: { createdAt: true },
		}),
		prisma.user.findMany({
			select: { id: true, name: true, email: true, image: true },
			orderBy: { createdAt: "asc" },
		}),
		prisma.pointLog.findMany({
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { createdAt: "desc" },
			take: 30,
		}),
		prisma.presetTask.findMany({
			where: {
				OR: [{ isShared: true }, { createdById: userId }],
			},
			orderBy: [{ isShared: "desc" }, { createdAt: "asc" }],
			select: {
				id: true,
				label: true,
				bucket: true,
				isShared: true,
				createdById: true,
				createdAt: true,
			},
		}),
		prisma.pointLog.count({
			where: {
				userId,
				revertedAt: null,
				kind: { in: ["PRESET", "TIMED"] },
				createdAt: { gte: weekStart },
			},
		}),
		prisma.pointLog.aggregate({
			where: {
				userId,
				revertedAt: null,
				kind: { in: ["PRESET", "TIMED"] },
				createdAt: { gte: weekStart },
			},
			_sum: { points: true },
		}),
		prisma.pointLog.findMany({
			where: {
				userId,
				revertedAt: null,
				kind: { in: ["PRESET", "TIMED"] },
			},
			select: { createdAt: true },
			orderBy: { createdAt: "desc" },
		}),
	]);

	return {
		pointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		users,
		recentLogs,
		presets,
		weeklyTaskCount,
		weeklyPoints: weeklyPointSum._sum.points ?? 0,
		lastTaskAt: taskLogDates[0]?.createdAt ?? null,
		currentStreak: getCurrentStreak(taskLogDates),
	};
}

function getCurrentStreak(taskLogDates: Array<{ createdAt: Date }>) {
	if (taskLogDates.length === 0) {
		return 0;
	}

	const dayKeys = new Set(taskLogDates.map((log) => toDayKey(log.createdAt)));
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	let streak = 0;
	while (true) {
		const day = new Date(today);
		day.setDate(day.getDate() - streak);
		if (!dayKeys.has(toDayKey(day))) {
			break;
		}
		streak += 1;
	}

	return streak;
}

function toDayKey(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
