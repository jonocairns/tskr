import type { Prisma } from "@prisma/client";
import { LogStatus } from "@prisma/client";

import { buildAssignedTaskEntries } from "@/lib/dashboard/assigned";
import { DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT } from "@/lib/formatDate";
import { applyUserPresetOrdering } from "@/lib/presetTaskOrdering";
import { getVisiblePresetWhere } from "@/lib/presetVisibility";
import { prisma } from "@/lib/prisma";
import { getRewardClaimAllowance } from "@/lib/rewardClaimLimits";
import { DEFAULT_TIME_ZONE, getStartOfWeekInTimeZone, getTimeZoneDayNumber } from "@/lib/timeZones";

const HISTORY_LIMIT = 10;
const APPROVALS_LIMIT = 10;
const STREAK_LIMIT_DAYS = 365;

// Full household history is required for cadence eligibility and Manage progress.
export const getHouseholdAssignedTasks = (householdId: string) =>
	prisma.assignedTask.findMany({
		where: {
			householdId,
			status: "ACTIVE",
		},
		include: {
			assignedTo: { select: { id: true, name: true, email: true } },
			preset: { select: { id: true, label: true, bucket: true } },
			logs: {
				where: {
					revertedAt: null,
					status: { in: [LogStatus.PENDING, LogStatus.APPROVED] },
				},
				select: { createdAt: true, status: true, user: { select: { id: true, name: true, email: true } } },
				orderBy: { createdAt: "asc" },
			},
		},
		orderBy: { assignedAt: "desc" },
	});

export async function getDashboardData(userId: string, householdId: string) {
	const now = new Date();
	const weekStart = new Date(now);
	weekStart.setDate(weekStart.getDate() - 7);
	const streakStart = new Date(now);
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
		presetOrders,
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
			select: {
				rewardThreshold: true,
				rewardClaimLimits: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } },
				progressBarColor: true,
				timeZone: true,
				dateFormat: true,
				timeFormat: true,
			},
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
			where: getVisiblePresetWhere(householdId, userId),
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				label: true,
				bucket: true,
				templateKey: true,
				iconKey: true,
				isShared: true,
				createdById: true,
				approvalOverride: true,
				createdAt: true,
			},
		}),
		prisma.presetTaskOrder.findMany({
			where: { householdId, userId },
			select: {
				presetId: true,
				sortOrder: true,
			},
		}),
		getHouseholdAssignedTasks(householdId),
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

	const timeZone = household?.timeZone ?? DEFAULT_TIME_ZONE;
	const householdDoneThisWeek = await prisma.pointLog.count({
		where: {
			householdId,
			kind: { in: ["PRESET", "TIMED"] },
			revertedAt: null,
			status: { in: [LogStatus.PENDING, LogStatus.APPROVED] },
			createdAt: { gte: getStartOfWeekInTimeZone(now, timeZone) },
		},
	});

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
	const orderedPresets = applyUserPresetOrdering(presets, presetOrders);

	return {
		pointSums,
		earnedPointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		firstActivity,
		rewardThreshold: household?.rewardThreshold ?? 50,
		rewardClaimAllowance: household
			? await getRewardClaimAllowance(prisma as unknown as Prisma.TransactionClient, household, householdId, userId)
			: null,
		progressBarColor: household?.progressBarColor ?? null,
		timeZone,
		dateFormat: household?.dateFormat ?? DEFAULT_DATE_FORMAT,
		timeFormat: household?.timeFormat ?? DEFAULT_TIME_FORMAT,
		users,
		recentLogs: trimmedLogs,
		hasMoreHistory,
		pendingLogs: trimmedApprovals,
		hasMoreApprovals,
		presets: orderedPresets,
		hasActiveAssignedTasks: assignedTasks.length > 0,
		householdDoneThisWeek,
		assignedTasks: buildAssignedTaskEntries({
			userId,
			tasks: assignedTasks,
			now,
			timeZone,
		}),
		weeklyTaskCount,
		weeklyPoints: weeklyPointSum._sum?.points ?? 0,
		hasApprovalMembers: approvalMemberCount > 0,
		lastTaskAt: taskLogDates[0]?.createdAt ?? null,
		currentStreak: getCurrentStreak(taskLogDates, household?.timeZone ?? DEFAULT_TIME_ZONE),
	};
}

export function getCurrentStreak(taskLogDates: Array<{ createdAt: Date }>, timeZone: string) {
	if (taskLogDates.length === 0) {
		return 0;
	}

	const dayNumbers = new Set(taskLogDates.map((log) => getTimeZoneDayNumber(log.createdAt, timeZone)));
	const todayNumber = getTimeZoneDayNumber(new Date(), timeZone);

	let streak = 0;
	while (true) {
		if (!dayNumbers.has(todayNumber - streak)) {
			break;
		}
		streak += 1;
	}

	return streak;
}
