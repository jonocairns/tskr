import { DURATION_KEYS, type DurationKey } from "@/lib/points";
import {
	addDaysInTimeZone,
	addMonthsInTimeZone,
	getStartOfDayInTimeZone,
	getStartOfWeekInTimeZone,
	parseDateInTimeZone,
} from "@/lib/timeZones";

export const WEEK_VIEW_PRESETS = ["calendarWeek", "thisWeek", "thisFortnight", "thisMonth"] as const;

export type WeekViewPreset = (typeof WEEK_VIEW_PRESETS)[number];

export type WeekViewRange = {
	start: Date;
	end: Date;
	labelKey: WeekViewPreset | "custom";
};

const isWeekViewPreset = (value: string | null | undefined): value is WeekViewPreset => {
	return !!value && (WEEK_VIEW_PRESETS as readonly string[]).includes(value);
};

const getRangeForPreset = ({ preset, now, timeZone }: { preset: WeekViewPreset; now: Date; timeZone: string }) => {
	if (preset === "calendarWeek") {
		const start = getStartOfWeekInTimeZone(now, timeZone);
		return { start, end: addDaysInTimeZone(start, 7, timeZone), labelKey: preset };
	}
	const end = addDaysInTimeZone(getStartOfDayInTimeZone(now, timeZone), 1, timeZone);

	if (preset === "thisWeek") {
		const start = addDaysInTimeZone(end, -7, timeZone);
		return { start, end, labelKey: preset };
	}

	if (preset === "thisFortnight") {
		const start = addDaysInTimeZone(end, -14, timeZone);
		return { start, end, labelKey: preset };
	}

	const start = addMonthsInTimeZone(end, -1, timeZone);
	return { start, end, labelKey: preset };
};

type WeekViewMember = { id: string; name: string | null; email: string | null };

export type WeekViewCompletedEntry = {
	id: string;
	type: "completed";
	occurredAt: string;
	description: string;
	points: number;
	status: "APPROVED" | "PENDING";
	bucket: DurationKey | null;
	assignedTaskId: string | null;
	assignedTo: WeekViewMember | null;
	completedBy: WeekViewMember;
};

export type WeekViewTimelineEntry = WeekViewCompletedEntry;

type CompletedLogRecord = {
	id: string;
	description: string;
	points: number;
	status: string;
	duration: string | null;
	createdAt: Date;
	assignedTaskId: string | null;
	assignedTask: { assignedTo: WeekViewMember | null } | null;
	user: WeekViewMember;
};

type BuildWeekViewTimelineInput = {
	completedLogs: CompletedLogRecord[];
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
	return getRangeForPreset({ preset: "calendarWeek", now, timeZone });
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
		assignedTo: log.assignedTask?.assignedTo ?? null,
		completedBy: log.user,
	}));
};

const compareTimelineEntries = (left: WeekViewTimelineEntry, right: WeekViewTimelineEntry) => {
	const leftTime = new Date(left.occurredAt).getTime();
	const rightTime = new Date(right.occurredAt).getTime();

	if (leftTime !== rightTime) {
		return rightTime - leftTime;
	}

	return left.id.localeCompare(right.id);
};

const buildWeekViewTimeline = ({ completedLogs }: BuildWeekViewTimelineInput) => {
	const completedEntries = buildCompletedEntries(completedLogs);
	const timeline = completedEntries.sort(compareTimelineEntries);
	const pendingCount = completedEntries.filter((entry) => entry.status === "PENDING").length;
	const approvedPoints = completedEntries
		.filter((entry) => entry.status === "APPROVED")
		.reduce((sum, entry) => sum + entry.points, 0);

	return {
		completedCount: completedEntries.length,
		pendingCount,
		approvedPoints,
		timeline,
	};
};

export { buildWeekViewTimeline, getDefaultWeekViewRange, parseWeekViewRange };
