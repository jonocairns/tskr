import type { Prisma } from "@prisma/client";
import { LogStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const HISTORY_LIMIT = 10;

export async function getDashboardData(userId: string, householdId: string) {
	const weekStart = new Date();
	weekStart.setDate(weekStart.getDate() - 7);
	const approvedWhere: Prisma.PointLogWhereInput = {
		householdId,
		revertedAt: null,
		status: LogStatus.APPROVED,
	};

	const [
		pointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		household,
		users,
		recentLogs,
		pendingLogs,
		presets,
		weeklyTaskCount,
		weeklyPointSum,
		taskLogDates,
		approvalMemberCount,
	] = await Promise.all([
		prisma.pointLog.groupBy({
			by: ["userId"],
			where: approvedWhere,
			_sum: { points: true },
		}),
		prisma.pointLog.groupBy({
			by: ["userId"],
			where: {
				...approvedWhere,
				kind: { in: ["PRESET", "TIMED"] },
			},
			_count: { _all: true },
		}),
		prisma.pointLog.groupBy({
			by: ["userId"],
			where: { ...approvedWhere, kind: "REWARD" },
			_count: { _all: true },
		}),
		prisma.pointLog.groupBy({
			by: ["userId"],
			where: approvedWhere,
			_max: { createdAt: true },
		}),
		prisma.household.findUnique({
			where: { id: householdId },
			select: { rewardThreshold: true },
		}),
		prisma.user.findMany({
			where: { memberships: { some: { householdId } } },
			select: { id: true, name: true, email: true, image: true },
			orderBy: { createdAt: "asc" },
		}),
		prisma.pointLog.findMany({
			where: { householdId },
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { createdAt: "desc" },
			take: HISTORY_LIMIT + 1,
		}),
		prisma.pointLog.findMany({
			where: {
				householdId,
				status: LogStatus.PENDING,
				revertedAt: null,
				kind: { in: ["PRESET", "TIMED"] },
			},
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { createdAt: "desc" },
			take: 20,
		}),
		prisma.presetTask.findMany({
			where: {
				householdId,
				OR: [{ isShared: true }, { createdById: userId }],
			},
			orderBy: [{ isShared: "desc" }, { createdAt: "asc" }],
			select: {
				id: true,
				label: true,
				bucket: true,
				isShared: true,
				createdById: true,
				approvalOverride: true,
				createdAt: true,
			},
		}),
		prisma.pointLog.count({
			where: {
				...approvedWhere,
				userId,
				kind: { in: ["PRESET", "TIMED"] },
				createdAt: { gte: weekStart },
			},
		}),
		prisma.pointLog.aggregate({
			where: {
				...approvedWhere,
				userId,
				kind: { in: ["PRESET", "TIMED"] },
				createdAt: { gte: weekStart },
			},
			_sum: { points: true },
		}),
		prisma.pointLog.findMany({
			where: {
				...approvedWhere,
				userId,
				kind: { in: ["PRESET", "TIMED"] },
			},
			select: { createdAt: true },
			orderBy: { createdAt: "desc" },
		}),
		prisma.householdMember.count({
			where: { householdId, requiresApprovalDefault: true },
		}),
	]);

	const hasMoreHistory = recentLogs.length > HISTORY_LIMIT;
	const trimmedLogs = hasMoreHistory
		? recentLogs.slice(0, HISTORY_LIMIT)
		: recentLogs;

	return {
		pointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		rewardThreshold: household?.rewardThreshold ?? 50,
		users,
		recentLogs: trimmedLogs,
		hasMoreHistory,
		pendingLogs,
		presets,
		weeklyTaskCount,
		weeklyPoints: weeklyPointSum._sum?.points ?? 0,
		hasApprovalMembers: approvalMemberCount > 0,
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
