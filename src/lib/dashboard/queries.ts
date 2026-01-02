import type { Prisma } from "@prisma/client";
import { LogStatus } from "@prisma/client";

import { buildAssignedTaskEntries } from "@/lib/dashboard/assigned";
import { prisma } from "@/lib/prisma";

const HISTORY_LIMIT = 10;
const APPROVALS_LIMIT = 10;
const STREAK_LIMIT_DAYS = 365;

export async function getDashboardData(userId: string, householdId: string) {
	const weekStart = new Date();
	weekStart.setDate(weekStart.getDate() - 7);
	const streakStart = new Date();
	streakStart.setDate(streakStart.getDate() - STREAK_LIMIT_DAYS);
	const approvedWhere: Prisma.PointLogWhereInput = {
		householdId,
		revertedAt: null,
		status: LogStatus.APPROVED,
	};

	const [
		pointSums,
		earnedTaskStats,
		rewardCounts,
		activityStats,
		household,
		users,
		recentLogs,
		pendingLogs,
		presets,
		assignedTasks,
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
			_sum: { points: true },
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
			_min: { createdAt: true },
		}),
		prisma.household.findUnique({
			where: { id: householdId },
			select: { rewardThreshold: true, progressBarColor: true },
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
			orderBy: { createdAt: "asc" },
			take: APPROVALS_LIMIT + 1,
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
		prisma.assignedTask.findMany({
			where: {
				householdId,
				assignedToId: userId,
				status: "ACTIVE",
			},
			include: {
				preset: { select: { id: true, label: true, bucket: true } },
				logs: {
					where: {
						revertedAt: null,
						status: { in: [LogStatus.PENDING, LogStatus.APPROVED] },
					},
					select: { createdAt: true },
					orderBy: { createdAt: "asc" },
				},
			},
			orderBy: { assignedAt: "desc" },
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
				createdAt: { gte: streakStart },
			},
			select: { createdAt: true },
			orderBy: { createdAt: "desc" },
		}),
		prisma.householdMember.count({
			where: { householdId, requiresApprovalDefault: true },
		}),
	]);

	const hasMoreHistory = recentLogs.length > HISTORY_LIMIT;
	const trimmedLogs = hasMoreHistory ? recentLogs.slice(0, HISTORY_LIMIT) : recentLogs;

	const hasMoreApprovals = pendingLogs.length > APPROVALS_LIMIT;
	const trimmedApprovals = hasMoreApprovals ? pendingLogs.slice(0, APPROVALS_LIMIT) : pendingLogs;

	const earnedPointSums = earnedTaskStats.map((item) => ({
		userId: item.userId,
		_sum: { points: item._sum.points },
	}));
	const taskCounts = earnedTaskStats.map((item) => ({
		userId: item.userId,
		_count: { _all: item._count._all },
	}));

	const lastActivity = activityStats.map((item) => ({
		userId: item.userId,
		_max: { createdAt: item._max.createdAt },
	}));
	const firstActivity = activityStats.map((item) => ({
		userId: item.userId,
		_min: { createdAt: item._min.createdAt },
	}));

	return {
		pointSums,
		earnedPointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		firstActivity,
		rewardThreshold: household?.rewardThreshold ?? 50,
		progressBarColor: household?.progressBarColor ?? null,
		users,
		recentLogs: trimmedLogs,
		hasMoreHistory,
		pendingLogs: trimmedApprovals,
		hasMoreApprovals,
		presets,
		assignedTasks: buildAssignedTaskEntries(assignedTasks),
		weeklyTaskCount,
		weeklyPoints: weeklyPointSum._sum?.points ?? 0,
		hasApprovalMembers: approvalMemberCount > 0,
		lastTaskAt: taskLogDates[0]?.createdAt ?? null,
		currentStreak: getCurrentStreak(taskLogDates),
	};
}

export function getCurrentStreak(taskLogDates: Array<{ createdAt: Date }>) {
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

export function toDayKey(date: Date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
