import { Temporal } from "@js-temporal/polyfill";

import { buildWeekViewTimeline, getDefaultWeekViewRange } from "@/lib/week-view/buildTimeline";

const atZoned = (
	timeZone: string,
	year: number,
	month: number,
	day: number,
	hour = 0,
	minute = 0,
	second = 0,
	millisecond = 0,
) =>
	new Date(
		Temporal.ZonedDateTime.from({
			timeZone,
			year,
			month,
			day,
			hour,
			minute,
			second,
			millisecond,
		}).toInstant().epochMilliseconds,
	);

type BuildInput = Parameters<typeof buildWeekViewTimeline>[0];
type CompletedLogRecord = BuildInput["completedLogs"][number];
type AssignedTaskRecord = BuildInput["tasks"][number];

const TIME_ZONE = "America/Los_Angeles";

const makeRange = (start: Date, end: Date) => ({
	start,
	end,
	label: "Past 7 days",
});

const makeLog = (overrides: Partial<CompletedLogRecord> = {}): CompletedLogRecord => ({
	id: "log-1",
	description: "Vacuum",
	points: 3,
	status: "APPROVED",
	duration: "QUICK",
	createdAt: atZoned(TIME_ZONE, 2024, 1, 2, 9, 0),
	assignedTaskId: null,
	...overrides,
});

const makeTask = (overrides: Partial<AssignedTaskRecord> = {}): AssignedTaskRecord => ({
	id: "task-1",
	assignedAt: atZoned(TIME_ZONE, 2024, 1, 2, 8, 0),
	cadenceTarget: 1,
	cadenceIntervalMinutes: 1440,
	isRecurring: false,
	preset: {
		id: "preset-1",
		label: "Vacuum",
		bucket: "QUICK",
	},
	...overrides,
});

test("suppresses one-off planned entries when a pending completion already exists", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));
	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [makeLog({ status: "PENDING", assignedTaskId: "task-1" })],
		tasks: [makeTask()],
	});

	expect(result.completedCount).toBe(1);
	expect(result.pendingCount).toBe(1);
	expect(result.approvedPoints).toBe(0);
	expect(result.plannedCount).toBe(0);
	expect(result.timeline).toHaveLength(1);
	expect(result.timeline[0]?.type).toBe("completed");
});

test("uses assignedAt for the first recurring occurrence inside a partial cadence window", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 3, 14, 30),
		cadenceIntervalMinutes: 10080,
		isRecurring: true,
	});

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(1);
	expect(result.timeline[0]).toMatchObject({
		type: "planned",
		occurredAt: task.assignedAt.toISOString(),
	});
});

test("keeps a recurring planned entry visible when the cadence target is not yet met", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 2, 0, 0), atZoned(TIME_ZONE, 2024, 1, 3, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 1, 8, 0),
		cadenceTarget: 2,
		isRecurring: true,
	});

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [makeLog({ assignedTaskId: task.id, createdAt: atZoned(TIME_ZONE, 2024, 1, 2, 9, 0) })],
		tasks: [task],
	});

	expect(result.completedCount).toBe(1);
	expect(result.plannedCount).toBe(1);
	expect(result.timeline[0]).toMatchObject({
		type: "planned",
		occurredAt: atZoned(TIME_ZONE, 2024, 1, 2, 0, 0).toISOString(),
	});
	expect(result.timeline[1]).toMatchObject({
		type: "completed",
	});
});

test("builds the default range from household-local day boundaries", () => {
	const now = atZoned(TIME_ZONE, 2024, 1, 7, 15, 45);
	const range = getDefaultWeekViewRange({ now, timeZone: TIME_ZONE });

	expect(range.label).toBe("Past 7 days");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0).toISOString());
	expect(range.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 8, 0, 0).toISOString());
});
