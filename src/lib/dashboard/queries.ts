import { prisma } from "@/lib/prisma";

export async function getDashboardData(userId: string) {
	const [
		pointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		users,
		recentLogs,
		presets,
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
			},
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
	};
}
