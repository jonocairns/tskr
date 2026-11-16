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

const TIME_ZONE = "America/Los_Angeles";

const makeLog = (overrides: Partial<CompletedLogRecord> = {}): CompletedLogRecord => ({
	id: "log-1",
	description: "Vacuum",
	points: 3,
	status: "APPROVED",
	duration: "QUICK",
	createdAt: atZoned(TIME_ZONE, 2024, 1, 2, 9, 0),
	assignedTaskId: null,
	assignedTask: null,
	user: { id: "sam", name: "Sam", email: null },
	...overrides,
});

test("defaults to the household calendar week, including the full Sunday", () => {
	const now = atZoned(TIME_ZONE, 2024, 1, 7, 15, 45);
	const range = getDefaultWeekViewRange({ now, timeZone: TIME_ZONE });

	expect(range.labelKey).toBe("calendarWeek");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0).toISOString());
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

test("uses calendar boundaries across a DST week", () => {
	const now = atZoned(TIME_ZONE, 2024, 3, 10, 15, 45);
	const range = getDefaultWeekViewRange({ now, timeZone: TIME_ZONE });

	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 3, 4, 0, 0).toISOString());
	expect(range.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 3, 11, 0, 0).toISOString());
	expect((range.end.getTime() - range.start.getTime()) / 3_600_000).toBe(167);
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

	expect(range.labelKey).toBe("calendarWeek");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0).toISOString());
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

	expect(range.labelKey).toBe("calendarWeek");
	expect(range.start.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 1, 0, 0).toISOString());
	expect(range.end.toISOString()).toBe(atZoned(TIME_ZONE, 2024, 1, 8, 0, 0).toISOString());
});

test("maps completed log status, points, and bucket onto timeline entries", () => {
	const result = buildWeekViewTimeline({
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
	expect(() =>
		buildWeekViewTimeline({
			completedLogs: [makeLog({ status: "REJECTED" })],
		}),
	).toThrow("Unexpected week-view completed log status: REJECTED");
});

test("falls back to QUICK for unknown bucket strings and to null when missing", () => {
	const result = buildWeekViewTimeline({
		completedLogs: [
			makeLog({ id: "log-unknown", duration: "MYSTERY" }),
			makeLog({
				id: "log-missing",
				duration: null,
				createdAt: atZoned(TIME_ZONE, 2024, 1, 3, 10, 0),
			}),
		],
	});

	const unknown = result.timeline.find((entry) => entry.id === "log-unknown");
	const missing = result.timeline.find((entry) => entry.id === "log-missing");
	expect(unknown).toMatchObject({ type: "completed", bucket: "QUICK" });
	expect(missing).toMatchObject({ type: "completed", bucket: null });
});

test("starts a new calendar week at the exact household-local Monday boundary", () => {
	const now = atZoned("Pacific/Auckland", 2024, 1, 8);
	const range = parseWeekViewRange({ now, timeZone: "Pacific/Auckland", preset: "calendarWeek" });
	expect(range).toEqual({
		start: now,
		end: atZoned("Pacific/Auckland", 2024, 1, 15),
		labelKey: "calendarWeek",
	});
	const previous = getDefaultWeekViewRange({ now: new Date(now.getTime() - 1), timeZone: "Pacific/Auckland" });
	expect(previous.start).toEqual(atZoned("Pacific/Auckland", 2024, 1, 1));
	expect(previous.end).toEqual(now);
});

test("orders completions latest first with stable IDs at equal times", () => {
	const sameMoment = atZoned(TIME_ZONE, 2024, 1, 5, 9);
	const result = buildWeekViewTimeline({
		completedLogs: [
			makeLog({ id: "b", createdAt: sameMoment }),
			makeLog({ id: "latest", createdAt: atZoned(TIME_ZONE, 2024, 1, 6, 8) }),
			makeLog({ id: "a", createdAt: sameMoment }),
		],
	});
	expect(result.timeline.map((entry) => entry.id)).toEqual(["latest", "a", "b"]);
});

test("preserves assignee, Open, completer and quick-log details", () => {
	const assignee = { id: "alex", name: null, email: "alex@example.com" };
	const completer = { id: "sam", name: "Sam", email: null };
	const result = buildWeekViewTimeline({
		completedLogs: [
			makeLog({ id: "assigned", assignedTaskId: "task", assignedTask: { assignedTo: assignee }, user: completer }),
			makeLog({ id: "open", assignedTaskId: "open-task", assignedTask: { assignedTo: null } }),
			makeLog({ id: "quick-log" }),
		],
	});
	expect(result.timeline.find((entry) => entry.id === "assigned")).toMatchObject({
		assignedTo: assignee,
		completedBy: completer,
	});
	expect(result.timeline.find((entry) => entry.id === "open")).toMatchObject({
		assignedTaskId: "open-task",
		assignedTo: null,
	});
	expect(result.timeline.find((entry) => entry.id === "quick-log")).toMatchObject({
		assignedTaskId: null,
		assignedTo: null,
	});
});
