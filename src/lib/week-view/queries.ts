import "server-only";

import { LogStatus } from "@prisma/client";

import { DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT } from "@/lib/formatDate";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE } from "@/lib/timeZones";
import { buildWeekViewTimeline, getDefaultWeekViewRange } from "@/lib/week-view/buildTimeline";

export const getWeekViewData = async ({
	householdId,
	now = new Date(),
	userId,
}: {
	householdId: string;
	now?: Date;
	userId: string;
}) => {
	const household = await prisma.household.findUnique({
		where: { id: householdId },
		select: {
			timeZone: true,
			dateFormat: true,
			timeFormat: true,
		},
	});

	const timeZone = household?.timeZone ?? DEFAULT_TIME_ZONE;
	const range = getDefaultWeekViewRange({ now, timeZone });

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
		dateFormat: household?.dateFormat ?? DEFAULT_DATE_FORMAT,
		timeFormat: household?.timeFormat ?? DEFAULT_TIME_FORMAT,
		...buildWeekViewTimeline({
			completedLogs,
			range,
			tasks,
			timeZone,
		}),
	};
};
