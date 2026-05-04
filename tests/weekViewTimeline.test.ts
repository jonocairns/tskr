import { Temporal } from "@js-temporal/polyfill";

import { buildWeekViewTimeline, getDefaultWeekViewRange, parseWeekViewRange } from "@/lib/week-view/buildTimeline";

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
	labelKey: "thisWeek" as const,
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
		now: atZoned(TIME_ZONE, 2024, 1, 4, 9, 0),
		completedLogs: [],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(1);
	expect(result.timeline[0]).toMatchObject({
		type: "planned",
		occurredAt: task.assignedAt.toISOString(),
	});
});

test("suppresses a recurring planned entry once the period target is already met", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 2, 0, 0), atZoned(TIME_ZONE, 2024, 1, 3, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 1, 8, 0),
		cadenceTarget: 1,
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

test("keeps a recurring planned entry when the period target is only partially complete", () => {
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
		now: atZoned(TIME_ZONE, 2024, 1, 2, 10, 0),
		tasks: [task],
	});

	expect(result.completedCount).toBe(1);
	expect(result.pendingCount).toBe(1);
	expect(result.plannedCount).toBe(1);
	expect(result.timeline).toHaveLength(2);
	expect(result.timeline.find((entry) => entry.type === "planned")).toMatchObject({
		type: "planned",
		cadenceIntervalMinutes: 1440,
		cadenceTarget: 2,
		remainingCount: 1,
		canComplete: true,
	});
});

test("suppresses older recurring planned entries outside the current cadence window", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 5, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 1, 0, 0),
		cadenceIntervalMinutes: 1440,
		isRecurring: true,
	});

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		now: atZoned(TIME_ZONE, 2024, 1, 4, 9, 0),
		completedLogs: [],
		tasks: [task],
	});

	const jan4Entry = result.timeline.find(
		(entry) => entry.type === "planned" && entry.occurredAt === atZoned(TIME_ZONE, 2024, 1, 4, 0, 0).toISOString(),
	);

	expect(result.plannedCount).toBe(1);
	expect(result.timeline).toHaveLength(1);
	expect(
		result.timeline.find(
			(entry) => entry.type === "planned" && entry.occurredAt === atZoned(TIME_ZONE, 2024, 1, 2, 0, 0).toISOString(),
		),
	).toBeUndefined();
	expect(jan4Entry).toMatchObject({ type: "planned", canComplete: true });
});

test("suppresses a future one-off planned entry before its assigned time", () => {
	const task = makeTask({ assignedAt: atZoned(TIME_ZONE, 2024, 1, 4, 9, 0) });
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		now: atZoned(TIME_ZONE, 2024, 1, 3, 12, 0),
		completedLogs: [],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(0);
	expect(result.timeline).toHaveLength(0);
});

test("builds the default range from household-local day boundaries", () => {
	const now = atZoned(TIME_ZONE, 2024, 1, 7, 15, 45);
	const range = getDefaultWeekViewRange({ now, timeZone: TIME_ZONE });

	expect(range.labelKey).toBe("thisFortnight");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2023, 12, 25, 0, 0).toISOString());
	expect(range.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 8, 0, 0).toISOString());
});

test("builds preset ranges as trailing windows that end at the next local midnight", () => {
	const now = atZoned(TIME_ZONE, 2024, 1, 10, 15, 45);

	const thisWeek = parseWeekViewRange({
		now,
		preset: "thisWeek",
		timeZone: TIME_ZONE,
	});
	const thisFortnight = parseWeekViewRange({
		now,
		preset: "thisFortnight",
		timeZone: TIME_ZONE,
	});

	expect(thisWeek.labelKey).toBe("thisWeek");
	expect(thisWeek.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 4, 0, 0).toISOString());
	expect(thisWeek.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 11, 0, 0).toISOString());
	expect(thisFortnight.labelKey).toBe("thisFortnight");
	expect(thisFortnight.start.toISOString()).toBe(atZoned(TIME_ZONE, 2023, 12, 28, 0, 0).toISOString());
	expect(thisFortnight.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 11, 0, 0).toISOString());
});

test("builds the default range from household-local day boundaries across DST changes", () => {
	const now = atZoned(TIME_ZONE, 2024, 3, 10, 15, 45);
	const range = getDefaultWeekViewRange({ now, timeZone: TIME_ZONE });

	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 2, 26, 0, 0).toISOString());
	expect(range.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 3, 11, 0, 0).toISOString());
});

test("builds the month preset as a trailing month instead of clipping to the current calendar month", () => {
	const now = atZoned(TIME_ZONE, 2024, 5, 4, 9, 0);
	const range = parseWeekViewRange({
		now,
		preset: "thisMonth",
		timeZone: TIME_ZONE,
	});

	expect(range.labelKey).toBe("thisMonth");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 4, 5, 0, 0).toISOString());
	expect(range.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 5, 5, 0, 0).toISOString());
});

test("parses custom from/to params against household-local day boundaries", () => {
	const range = parseWeekViewRange({
		from: "2024-01-10",
		to: "2024-01-12",
		timeZone: TIME_ZONE,
	});

	expect(range.labelKey).toBe("custom");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 10, 0, 0).toISOString());
	expect(range.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 13, 0, 0).toISOString());
});

test("falls back to the default range when custom params are invalid", () => {
	const now = atZoned(TIME_ZONE, 2024, 1, 7, 15, 45);
	const range = parseWeekViewRange({
		from: "2024-01-12",
		to: "2024-01-10",
		now,
		timeZone: TIME_ZONE,
	});

	expect(range.labelKey).toBe("thisFortnight");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2023, 12, 25, 0, 0).toISOString());
	expect(range.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 8, 0, 0).toISOString());
});

test.each([
	{ from: "2024-01-10", to: undefined },
	{ from: undefined, to: "2024-01-12" },
	{ from: "2024-13-40", to: "2024-01-12" },
	{ from: "2024-01-10", to: "2024-13-40" },
])("falls back to the default range when params are partial or malformed: %j", ({ from, to }) => {
	const now = atZoned(TIME_ZONE, 2024, 1, 7, 15, 45);
	const range = parseWeekViewRange({
		from,
		to,
		now,
		timeZone: TIME_ZONE,
	});

	expect(range.labelKey).toBe("thisFortnight");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2023, 12, 25, 0, 0).toISOString());
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

test("throws when a completed log status falls outside the week-view invariant", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));

	expect(() =>
		buildWeekViewTimeline({
			range,
			timeZone: TIME_ZONE,
			completedLogs: [makeLog({ status: "REJECTED" })],
			tasks: [],
		}),
	).toThrow("Unexpected week-view completed log status: REJECTED");
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
		now: atZoned(TIME_ZONE, 2024, 1, 4, 12, 0),
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
		cadenceIntervalMinutes: null,
		cadenceTarget: 1,
		remainingCount: 1,
		canComplete: true,
	});
});

test("suppresses one-off planned entries after any pending or approved completion", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 1, 8, 0, 0));
	const task = makeTask({
		cadenceTarget: 4,
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 4, 9, 0),
	});

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		completedLogs: [makeLog({ assignedTaskId: task.id, status: "PENDING" })],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(0);
	expect(result.timeline).toHaveLength(1);
	expect(result.timeline[0]).toMatchObject({
		type: "completed",
		status: "PENDING",
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
		now: atZoned(TIME_ZONE, 2024, 1, 3, 10, 0),
		completedLogs: [],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(1);
	expect(result.timeline.every((entry) => entry.type === "planned")).toBe(true);
	expect(result.timeline[0]).toMatchObject({
		type: "planned",
		occurredAt: atZoned(TIME_ZONE, 2024, 1, 3, 0, 0).toISOString(),
	});
});

test("finds the current recurring planned entry inside a long custom range", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0), atZoned(TIME_ZONE, 2024, 2, 10, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 1, 1, 0, 0),
		cadenceIntervalMinutes: 1440,
		isRecurring: true,
	});

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		now: atZoned(TIME_ZONE, 2024, 2, 9, 10, 0),
		completedLogs: [],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(1);
	expect(result.timeline[0]).toMatchObject({
		type: "planned",
		occurredAt: atZoned(TIME_ZONE, 2024, 2, 9, 0, 0).toISOString(),
	});
});

test("keeps the current recurring planned entry when its cadence window overlaps the month boundary", () => {
	const range = makeRange(atZoned(TIME_ZONE, 2024, 5, 1, 0, 0), atZoned(TIME_ZONE, 2024, 6, 1, 0, 0));
	const task = makeTask({
		assignedAt: atZoned(TIME_ZONE, 2024, 4, 1, 0, 0),
		cadenceIntervalMinutes: 10080,
		isRecurring: true,
	});

	const result = buildWeekViewTimeline({
		range,
		timeZone: TIME_ZONE,
		now: atZoned(TIME_ZONE, 2024, 5, 2, 9, 0),
		completedLogs: [],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(1);
	expect(result.timeline[0]).toMatchObject({
		type: "planned",
		occurredAt: atZoned(TIME_ZONE, 2024, 5, 1, 0, 0).toISOString(),
		canComplete: true,
	});
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
		now: atZoned(TIME_ZONE, 2024, 1, 3, 10, 0),
		completedLogs: [
			makeLog({
				id: "log-day-2",
				assignedTaskId: task.id,
				createdAt: atZoned(TIME_ZONE, 2024, 1, 2, 12, 0),
			}),
		],
		tasks: [task],
	});

	expect(result.plannedCount).toBe(1);
	const plannedDays = result.timeline.filter((entry) => entry.type === "planned").map((entry) => entry.occurredAt);
	expect(plannedDays).not.toContain(atZoned(TIME_ZONE, 2024, 1, 2, 0, 0).toISOString());
	expect(plannedDays).toEqual([atZoned(TIME_ZONE, 2024, 1, 3, 0, 0).toISOString()]);
});

test("orders the timeline by latest first and places completed before planned at equal times", () => {
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

	expect(result.timeline.map((entry) => entry.id)).toEqual(["log-late", "log-tie", expect.stringMatching(/^task-1:/)]);
});
