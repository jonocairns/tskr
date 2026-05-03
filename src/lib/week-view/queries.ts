import "server-only";

import { LogStatus } from "@prisma/client";

import { type DateFormat, DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT, type TimeFormat } from "@/lib/formatDate";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE } from "@/lib/timeZones";
import { buildWeekViewTimeline, type WeekViewRange } from "@/lib/week-view/buildTimeline";

export const getWeekViewHouseholdSettings = async (householdId: string) => {
	const household = await prisma.household.findUnique({
		where: { id: householdId },
		select: {
			timeZone: true,
			dateFormat: true,
			timeFormat: true,
		},
	});

	return {
		timeZone: household?.timeZone ?? DEFAULT_TIME_ZONE,
		dateFormat: household?.dateFormat ?? DEFAULT_DATE_FORMAT,
		timeFormat: household?.timeFormat ?? DEFAULT_TIME_FORMAT,
	} satisfies {
		dateFormat: DateFormat;
		timeFormat: TimeFormat;
		timeZone: string;
	};
};

export const getWeekViewData = async ({
	householdId,
	range,
	userId,
	dateFormat,
	timeFormat,
	timeZone,
}: {
	householdId: string;
	range: WeekViewRange;
	userId: string;
	dateFormat: DateFormat;
	timeFormat: TimeFormat;
	timeZone: string;
}) => {
	const [completedLogs, tasks] = await Promise.all([
		prisma.pointLog.findMany({
			where: {
				householdId,
				userId,
				kind: { in: ["PRESET", "TIMED"] },
				revertedAt: null,
				status: { in: [LogStatus.PENDING, LogStatus.APPROVED] },
				createdAt: {
					gte: range.start,
					lt: range.end,
				},
			},
			select: {
				id: true,
				description: true,
				points: true,
				status: true,
				duration: true,
				createdAt: true,
				assignedTaskId: true,
			},
			orderBy: { createdAt: "asc" },
		}),
		prisma.assignedTask.findMany({
			where: {
				householdId,
				assignedToId: userId,
				status: "ACTIVE",
			},
			select: {
				id: true,
				assignedAt: true,
				cadenceTarget: true,
				cadenceIntervalMinutes: true,
				isRecurring: true,
				preset: {
					select: {
						id: true,
						label: true,
						bucket: true,
					},
				},
			},
			orderBy: { assignedAt: "asc" },
		}),
	]);

	return {
		range,
		timeZone,
		dateFormat,
		timeFormat,
		...buildWeekViewTimeline({
			completedLogs,
			range,
			tasks,
			timeZone,
		}),
	};
};
