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
	labelKey: "past7Days" as const,
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

test("suppresses a recurring planned entry once a pending completion exists in that period", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 2, 0, 0), atZoned(TIME_ZONE, 2024, 1, 3, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 1, 8, 0),
		cadenceTarget: 2,
		isRecurring: true,
	});

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [
			makeLog({
				assignedTaskId: task.id,
				createdAt: atZoned(TIME_ZONE, 2024, 1, 2, 9, 0),
				status: "PENDING",
			}),
		],
		tasks: [task],
	});

	expect(result.completedCount).toBe(1);
	expect(result.pendingCount).toBe(1);
	expect(result.plannedCount).toBe(0);
	expect(result.timeline).toHaveLength(1);
	expect(result.timeline[0]).toMatchObject({
		type: "completed",
		status: "PENDING",
	});
});

test("builds the default range from household-local day boundaries", () => {
	const now = atZoned(TIME_ZONE, 2024, 1, 7, 15, 45);
	const range = getDefaultWeekViewRange({ now, timeZone: TIME_ZONE });

	expect(range.labelKey).toBe("past7Days");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0).toISOString());
	expect(range.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 8, 0, 0).toISOString());
});

test("maps completed log status, points, and bucket onto timeline entries", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));
	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [
			makeLog({ id: "log-pending", status: "PENDING", points: 4, duration: "ROUTINE" }),
			makeLog({
				id: "log-approved",
				status: "APPROVED",
				points: 6,
				duration: "HEAVY",
				createdAt: atZoned(TIME_ZONE, 2024, 1, 3, 10, 0),
			}),
		],
		tasks: [],
	});

	expect(result.completedCount).toBe(2);
	expect(result.pendingCount).toBe(1);
	expect(result.approvedPoints).toBe(6);
	const pending = result.timeline.find((entry) => entry.id === "log-pending");
	const approved = result.timeline.find((entry) => entry.id === "log-approved");
	expect(pending).toMatchObject({ type: "completed", status: "PENDING", bucket: "ROUTINE" });
	expect(approved).toMatchObject({ type: "completed", status: "APPROVED", bucket: "HEAVY" });
});

test("falls back to QUICK for unknown bucket strings and to null when missing", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));
	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [
			makeLog({ id: "log-unknown", duration: "MYSTERY" }),
			makeLog({
				id: "log-missing",
				duration: null,
				createdAt: atZoned(TIME_ZONE, 2024, 1, 3, 10, 0),
			}),
		],
		tasks: [],
	});

	const unknown = result.timeline.find((entry) => entry.id === "log-unknown");
	const missing = result.timeline.find((entry) => entry.id === "log-missing");
	expect(unknown).toMatchObject({ type: "completed", bucket: "QUICK" });
	expect(missing).toMatchObject({ type: "completed", bucket: null });
});

test("emits a one-off planned entry with preset metadata when assignedAt is in range", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 4, 9, 0),
		preset: { id: "preset-1", label: "Mop floors", bucket: "ROUTINE" },
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
		assignedTaskId: task.id,
		description: "Mop floors",
		bucket: "ROUTINE",
		points: 6,
		isRecurring: false,
		cadenceLabel: "One-off",
	});
});

test("suppresses one-off planned entries whose assignedAt sits outside the range", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));
	const task = makeTask({ assignedAt: atZoned(TIME_ZONE, 2023, 12, 30, 9, 0) });

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(0);
});

test("skips tasks without a preset", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));
	const task = makeTask({ preset: null });

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(0);
	expect(result.timeline).toHaveLength(0);
});

test("emits a recurring planned entry per cadence period when targets are unmet", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 4, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 1, 0, 0),
		cadenceIntervalMinutes: 1440,
		isRecurring: true,
	});

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(3);
	expect(result.timeline.every((entry) => entry.type === "planned")).toBe(true);
});

test("suppresses a recurring planned entry for a period whose target is already met", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 4, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 1, 0, 0),
		cadenceIntervalMinutes: 1440,
		isRecurring: true,
	});

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [
			makeLog({
				id: "log-day-2",
				assignedTaskId: task.id,
				createdAt: atZoned(TIME_ZONE, 2024, 1, 2, 12, 0),
			}),
		],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(2);
	const plannedDays = result.timeline.filter((entry) => entry.type === "planned").map((entry) => entry.occurredAt);
	expect(plannedDays).not.toContain(atZoned(TIME_ZONE, 2024, 1, 2, 0, 0).toISOString());
});

test("orders the timeline by time and places completed before planned at equal times", () => {
	const sameMoment = atZoned(TIME_ZONE, 2024, 1, 5, 9, 0);
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));
	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [
			makeLog({ id: "log-late", createdAt: atZoned(TIME_ZONE, 2024, 1, 6, 8, 0) }),
			makeLog({ id: "log-tie", createdAt: sameMoment }),
		],
		tasks: [makeTask({ assignedAt: sameMoment })],
	});

	expect(result.timeline.map((entry) => entry.id)).toEqual(["log-tie", expect.stringMatching(/^task-1:/), "log-late"]);
});
