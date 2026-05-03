import { getAssignedTaskPeriodBounds } from "@/lib/assignedTasks";
import { DURATION_KEYS, type DurationKey, getBucketPoints } from "@/lib/points";
import {
	addDaysInTimeZone,
	addMonthsInTimeZone,
	getStartOfMonthInTimeZone,
	getStartOfWeekInTimeZone,
	parseDateInTimeZone,
} from "@/lib/timeZones";

export const WEEK_VIEW_PRESETS = ["thisWeek", "thisFortnight", "thisMonth"] as const;

export type WeekViewPreset = (typeof WEEK_VIEW_PRESETS)[number];

export type WeekViewRange = {
	start: Date;
	end: Date;
	labelKey: WeekViewPreset | "custom";
};

const isWeekViewPreset = (value: string | null | undefined): value is WeekViewPreset => {
	return !!value && (WEEK_VIEW_PRESETS as readonly string[]).includes(value);
};

const getRangeForPreset = ({
	preset,
	now,
	timeZone,
}: {
	preset: WeekViewPreset;
	now: Date;
	timeZone: string;
}): WeekViewRange => {
	if (preset === "thisWeek") {
		const start = getStartOfWeekInTimeZone(now, timeZone);
		const end = addDaysInTimeZone(start, 7, timeZone);
		return { start, end, labelKey: "thisWeek" };
	}

	if (preset === "thisFortnight") {
		const startOfThisWeek = getStartOfWeekInTimeZone(now, timeZone);
		const start = addDaysInTimeZone(startOfThisWeek, -7, timeZone);
		const end = addDaysInTimeZone(startOfThisWeek, 7, timeZone);
		return { start, end, labelKey: "thisFortnight" };
	}

	const start = getStartOfMonthInTimeZone(now, timeZone);
	const end = getStartOfMonthInTimeZone(addMonthsInTimeZone(start, 1, timeZone), timeZone);
	return { start, end, labelKey: "thisMonth" };
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
	cadenceIntervalMinutes: number | null;
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

const WEEK_VIEW_COMPLETED_STATUSES = ["APPROVED", "PENDING"] as const;

const isWeekViewCompletedStatus = (status: string): status is WeekViewCompletedEntry["status"] => {
	return WEEK_VIEW_COMPLETED_STATUSES.includes(status as WeekViewCompletedEntry["status"]);
};

const resolveBucket = (bucket: string | null | undefined) => {
	if (!bucket) {
		return null;
	}
	return isDurationKey(bucket) ? bucket : "QUICK";
};

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getDefaultWeekViewRange = ({ now = new Date(), timeZone }: { now?: Date; timeZone: string }) => {
	return getRangeForPreset({ preset: "thisWeek", now, timeZone });
};

const parseWeekViewRange = ({
	from,
	now = new Date(),
	preset,
	timeZone,
	to,
}: {
	from?: string | null;
	now?: Date;
	preset?: string | null;
	timeZone: string;
	to?: string | null;
}) => {
	if (isWeekViewPreset(preset)) {
		return getRangeForPreset({ preset, now, timeZone });
	}

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

const resolveCompletedStatus = (status: string) => {
	if (isWeekViewCompletedStatus(status)) {
		return status;
	}

	throw new Error(`Unexpected week-view completed log status: ${status}`);
};

const buildCompletedEntries = (completedLogs: CompletedLogRecord[]) => {
	return completedLogs.map<WeekViewCompletedEntry>((log) => ({
		id: log.id,
		type: "completed",
		occurredAt: log.createdAt.toISOString(),
		description: log.description,
		points: log.points,
		status: resolveCompletedStatus(log.status),
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
			cadenceIntervalMinutes: null,
			cadenceTarget: 1,
			remainingCount: 1,
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
			const periodLogCount = logs.filter((log) => log.createdAt >= periodStart && log.createdAt < periodEnd).length;
			const remainingCount = Math.max(target - periodLogCount, 0);

			if (remainingCount > 0) {
				entries.push({
					id: `${task.id}:${periodStart.toISOString()}`,
					type: "planned",
					occurredAt: occurrenceAt.toISOString(),
					description: task.preset.label,
					points: getBucketPoints(bucket),
					bucket,
					assignedTaskId: task.id,
					isRecurring: true,
					cadenceIntervalMinutes: task.cadenceIntervalMinutes,
					cadenceTarget: target,
					remainingCount,
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
			return taskLogs.length > 0 ? [] : buildOneOffPlannedEntry({ task, range });
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
