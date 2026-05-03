import { getAssignedTaskPeriodBounds } from "@/lib/assignedTasks";
import { formatCadenceInterval } from "@/lib/assignedTasksCadence";
import { DURATION_KEYS, type DurationKey, getBucketPoints } from "@/lib/points";
import { addDaysInTimeZone, getStartOfDayInTimeZone, parseDateInTimeZone } from "@/lib/timeZones";

export type WeekViewRange = {
	start: Date;
	end: Date;
	labelKey: "custom" | "past7Days";
};

export type WeekViewCompletedEntry = {
	id: string;
	type: "completed";
	occurredAt: string;
	description: string;
	points: number;
	status: "APPROVED" | "PENDING";
	bucket: DurationKey | null;
	assignedTaskId: string | null;
};

export type WeekViewPlannedEntry = {
	id: string;
	type: "planned";
	occurredAt: string;
	description: string;
	points: number;
	bucket: DurationKey;
	assignedTaskId: string;
	isRecurring: boolean;
	cadenceLabel: string;
	cadenceTarget: number;
	remainingCount: number;
};

export type WeekViewTimelineEntry = WeekViewCompletedEntry | WeekViewPlannedEntry;

type CompletedLogRecord = {
	id: string;
	description: string;
	points: number;
	status: string;
	duration: string | null;
	createdAt: Date;
	assignedTaskId: string | null;
};

type AssignedTaskRecord = {
	id: string;
	assignedAt: Date;
	cadenceTarget: number;
	cadenceIntervalMinutes: number;
	isRecurring: boolean;
	preset: { id: string; label: string; bucket: string } | null;
};

type BuildWeekViewTimelineInput = {
	completedLogs: CompletedLogRecord[];
	range: WeekViewRange;
	tasks: AssignedTaskRecord[];
	timeZone: string;
};

const isDurationKey = (bucket: string): bucket is DurationKey => DURATION_KEYS.includes(bucket as DurationKey);

const resolveBucket = (bucket: string | null | undefined) => {
	if (!bucket) {
		return null;
	}
	return isDurationKey(bucket) ? bucket : "QUICK";
};

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getDefaultWeekViewRange = ({ now = new Date(), timeZone }: { now?: Date; timeZone: string }) => {
	const todayStart = getStartOfDayInTimeZone(now, timeZone);
	const end = addDaysInTimeZone(todayStart, 1, timeZone);
	const start = addDaysInTimeZone(end, -7, timeZone);

	return {
		start,
		end,
		labelKey: "past7Days",
	} satisfies WeekViewRange;
};

const parseWeekViewRange = ({
	from,
	now = new Date(),
	timeZone,
	to,
}: {
	from?: string | null;
	now?: Date;
	timeZone: string;
	to?: string | null;
}) => {
	if (!from && !to) {
		return getDefaultWeekViewRange({ now, timeZone });
	}

	if (!from || !to || !DATE_PARAM_PATTERN.test(from) || !DATE_PARAM_PATTERN.test(to)) {
		return getDefaultWeekViewRange({ now, timeZone });
	}

	const start = parseDateInTimeZone(from, timeZone);
	const inclusiveEnd = parseDateInTimeZone(to, timeZone);

	if (!start || !inclusiveEnd || inclusiveEnd < start) {
		return getDefaultWeekViewRange({ now, timeZone });
	}

	return {
		start,
		end: addDaysInTimeZone(inclusiveEnd, 1, timeZone),
		labelKey: "custom",
	} satisfies WeekViewRange;
};

const buildCompletedEntries = (completedLogs: CompletedLogRecord[]) => {
	return completedLogs.map<WeekViewCompletedEntry>((log) => ({
		id: log.id,
		type: "completed",
		occurredAt: log.createdAt.toISOString(),
		description: log.description,
		points: log.points,
		status: log.status === "PENDING" ? "PENDING" : "APPROVED",
		bucket: resolveBucket(log.duration),
		assignedTaskId: log.assignedTaskId,
	}));
};

const buildTaskLogMap = (completedLogs: CompletedLogRecord[]) => {
	const logsByTaskId = new Map<string, CompletedLogRecord[]>();

	for (const log of completedLogs) {
		if (!log.assignedTaskId) {
			continue;
		}

		const taskLogs = logsByTaskId.get(log.assignedTaskId) ?? [];
		taskLogs.push(log);
		logsByTaskId.set(log.assignedTaskId, taskLogs);
	}

	return logsByTaskId;
};

const buildOneOffPlannedEntry = ({ task, range }: { task: AssignedTaskRecord; range: WeekViewRange }) => {
	if (!task.preset) {
		return [];
	}

	if (task.assignedAt < range.start || task.assignedAt >= range.end) {
		return [];
	}

	const bucket = resolveBucket(task.preset.bucket) ?? "QUICK";
	const target = Math.max(task.cadenceTarget, 1);

	return [
		{
			id: `${task.id}:${task.assignedAt.toISOString()}`,
			type: "planned" as const,
			occurredAt: task.assignedAt.toISOString(),
			description: task.preset.label,
			points: getBucketPoints(bucket),
			bucket,
			assignedTaskId: task.id,
			isRecurring: false,
			cadenceLabel: "One-off",
			cadenceTarget: target,
			remainingCount: target,
		},
	];
};

const buildRecurringPlannedEntries = ({
	logs,
	range,
	task,
	timeZone,
}: {
	logs: CompletedLogRecord[];
	range: WeekViewRange;
	task: AssignedTaskRecord;
	timeZone: string;
}) => {
	if (!task.preset) {
		return [];
	}

	const bucket = resolveBucket(task.preset.bucket) ?? "QUICK";
	const target = Math.max(task.cadenceTarget, 1);
	const entries: WeekViewPlannedEntry[] = [];
	if (task.assignedAt >= range.end) {
		return entries;
	}

	let { periodStart } = getAssignedTaskPeriodBounds(range.start, task.cadenceIntervalMinutes, timeZone);

	while (periodStart < range.end) {
		const { periodEnd } = getAssignedTaskPeriodBounds(periodStart, task.cadenceIntervalMinutes, timeZone);
		if (periodEnd.getTime() <= periodStart.getTime()) {
			break;
		}
		const occurrenceAt = periodStart > task.assignedAt ? periodStart : task.assignedAt;

		if (periodEnd > task.assignedAt && occurrenceAt >= range.start && occurrenceAt < range.end) {
			const hasMatchingLog = logs.some((log) => log.createdAt >= periodStart && log.createdAt < periodEnd);
			if (!hasMatchingLog) {
				entries.push({
					id: `${task.id}:${periodStart.toISOString()}`,
					type: "planned",
					occurredAt: occurrenceAt.toISOString(),
					description: task.preset.label,
					points: getBucketPoints(bucket),
					bucket,
					assignedTaskId: task.id,
					isRecurring: true,
					cadenceLabel: formatCadenceInterval(task.cadenceIntervalMinutes),
					cadenceTarget: target,
					remainingCount: target,
				});
			}
		}

		periodStart = periodEnd;
	}

	return entries;
};

const buildPlannedEntries = ({ completedLogs, range, tasks, timeZone }: BuildWeekViewTimelineInput) => {
	const logsByTaskId = buildTaskLogMap(completedLogs);

	return tasks.flatMap((task) => {
		if (!task.preset) {
			return [];
		}

		const taskLogs = logsByTaskId.get(task.id) ?? [];

		if (!task.isRecurring) {
			const target = Math.max(task.cadenceTarget, 1);
			return taskLogs.length >= target ? [] : buildOneOffPlannedEntry({ task, range });
		}

		return buildRecurringPlannedEntries({
			task,
			logs: taskLogs,
			range,
			timeZone,
		});
	});
};

const compareTimelineEntries = (left: WeekViewTimelineEntry, right: WeekViewTimelineEntry) => {
	const leftTime = new Date(left.occurredAt).getTime();
	const rightTime = new Date(right.occurredAt).getTime();

	if (leftTime !== rightTime) {
		return leftTime - rightTime;
	}

	if (left.type !== right.type) {
		return left.type === "completed" ? -1 : 1;
	}

	return left.id.localeCompare(right.id);
};

const buildWeekViewTimeline = ({ completedLogs, range, tasks, timeZone }: BuildWeekViewTimelineInput) => {
	const completedEntries = buildCompletedEntries(completedLogs);
	const plannedEntries = buildPlannedEntries({
		completedLogs,
		range,
		tasks,
		timeZone,
	});
	const timeline = [...completedEntries, ...plannedEntries].sort(compareTimelineEntries);
	const pendingCount = completedEntries.filter((entry) => entry.status === "PENDING").length;
	const approvedPoints = completedEntries
		.filter((entry) => entry.status === "APPROVED")
		.reduce((sum, entry) => sum + entry.points, 0);

	return {
		completedCount: completedEntries.length,
		pendingCount,
		approvedPoints,
		plannedCount: plannedEntries.length,
		timeline,
	};
};

export { buildWeekViewTimeline, getDefaultWeekViewRange, parseWeekViewRange };
