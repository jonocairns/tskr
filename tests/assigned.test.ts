import { buildAssignedTaskEntries } from "@/lib/dashboard/assigned";
import { getBucketPoints } from "@/lib/points";

type AssignedTaskRecord = Parameters<typeof buildAssignedTaskEntries>[0]["tasks"][number];

const TIME_ZONE = "UTC";
const NOW = new Date("2024-01-08T00:00:00.000Z");

const makeLog = (
	createdAt: Date,
	status = "APPROVED",
	user: { id: string; name: string | null; email: string | null } = { id: "viewer", name: "Alex", email: null },
) => ({ createdAt, status, user });

const makeTask = (overrides: Partial<AssignedTaskRecord> = {}) => ({
	id: "task-1",
	assignedAt: new Date("2024-01-01T00:00:00.000Z"),
	status: "ACTIVE",
	assignedTo: { id: "viewer", name: "Alex", email: null },
	cadenceTarget: 1,
	cadenceIntervalMinutes: 10080,
	isRecurring: true,
	preset: { id: "preset-1", label: "Vacuum", bucket: "QUICK" },
	logs: [],
	...overrides,
});

const buildEntries = (task: AssignedTaskRecord, now = NOW, timeZone = TIME_ZONE) =>
	buildAssignedTaskEntries({ tasks: [task], userId: "viewer", now, timeZone });

test("filters non-ACTIVE tasks and tasks without a preset", () => {
	expect(buildEntries(makeTask({ status: "COMPLETED" }))).toEqual([]);
	expect(buildEntries(makeTask({ preset: null }))).toEqual([]);
});

test("falls back to QUICK for invalid buckets and returns ISO timestamps", () => {
	const task = makeTask({ preset: { id: "preset-2", label: "Custom", bucket: "NOT-A-BUCKET" } });
	const [entry] = buildEntries(task);
	expect(entry).toMatchObject({
		bucket: "QUICK",
		points: getBucketPoints("QUICK"),
		assignedAt: task.assignedAt.toISOString(),
		completedLastCycle: false,
		lastCompletedAt: null,
		nextResetAt: "2024-01-15T00:00:00.000Z",
	});
});

test("acknowledges the previous cycle immediately after a late completion and reset", () => {
	const completedAt = new Date("2024-01-07T23:30:00.000Z");
	const task = makeTask({ logs: [makeLog(completedAt)] });
	expect(buildEntries(task, completedAt)).toEqual([]);
	expect(buildEntries(task)).toMatchObject([
		{ progress: 0, completedLastCycle: true, lastCompletedAt: completedAt.toISOString() },
	]);
});

test("does not tag partial progress or a completion from an older cycle as completed last cycle", () => {
	const logs = [makeLog(new Date("2024-01-07T23:30:00.000Z"))];
	expect(buildEntries(makeTask({ logs, cadenceTarget: 2 }))[0]?.completedLastCycle).toBe(false);
	expect(buildEntries(makeTask({ logs }), new Date("2024-01-15T00:00:00.000Z"))[0]).toMatchObject({
		completedLastCycle: false,
		lastCompletedAt: logs[0].createdAt.toISOString(),
	});
});

test("keeps previous-cycle acknowledgement while showing current-cycle progress", () => {
	const logs = [
		makeLog(new Date("2024-01-07T12:00:00.000Z")),
		makeLog(new Date("2024-01-07T23:30:00.000Z")),
		makeLog(NOW),
	];
	expect(buildEntries(makeTask({ logs, cadenceTarget: 2 }))[0]).toMatchObject({
		progress: 1,
		completedLastCycle: true,
		lastCompletedAt: NOW.toISOString(),
	});
});

test("uses household-local previous days across a 23-hour DST day", () => {
	const completedAt = new Date("2024-09-29T10:30:00.000Z"); // Sunday 23:30 NZDT
	const now = new Date("2024-09-29T11:00:00.000Z"); // Monday 00:00 NZDT
	const task = makeTask({ cadenceIntervalMinutes: 1440, logs: [makeLog(completedAt)] });
	expect(buildEntries(task, now, "Pacific/Auckland")[0]).toMatchObject({
		progress: 0,
		completedLastCycle: true,
		nextResetAt: "2024-09-30T11:00:00.000Z",
	});
});

test("one-offs have no previous cycle or reset date", () => {
	expect(buildEntries(makeTask({ isRecurring: false }))[0]).toMatchObject({
		completedLastCycle: false,
		lastCompletedAt: null,
		nextResetAt: null,
	});
	expect(buildEntries(makeTask({ isRecurring: false, logs: [makeLog(NOW)] }))).toEqual([]);
});

test("groups available tasks relative to the viewer, including Open and email-only assignees", () => {
	const tasks = [
		makeTask(),
		makeTask({ id: "open", assignedTo: null }),
		makeTask({ id: "other", assignedTo: { id: "sam", name: "Sam", email: null } }),
		makeTask({ id: "email", assignedTo: { id: "email", name: null, email: "person@example.com" } }),
	];
	expect(buildAssignedTaskEntries({ tasks, userId: "viewer", now: NOW, timeZone: TIME_ZONE })).toMatchObject([
		{ id: "task-1", group: "mine", assigneeLabel: "Alex", state: "available" },
		{ id: "open", group: "open", assigneeLabel: null, state: "available" },
		{ id: "other", group: "others", assigneeLabel: "Sam", state: "available" },
		{ id: "email", group: "others", assigneeLabel: "person@example.com", state: "available" },
	]);
});

test.each([true, false])("retains full periods/lifetimes with pending completions (recurring: %s)", (isRecurring) => {
	const sam = { id: "sam", name: "Sam", email: null };
	const emailOnly = { id: "email", name: null, email: "person@example.com" };
	const logs = [
		makeLog(NOW),
		makeLog(NOW, "PENDING", sam),
		makeLog(NOW, "PENDING", sam),
		makeLog(NOW, "PENDING", emailOnly),
	];
	const [entry] = buildEntries(makeTask({ isRecurring, cadenceTarget: 4, logs }));
	expect(entry).toMatchObject({
		state: "awaitingApproval",
		progress: 4,
		pendingCompleters: ["Sam", "person@example.com"],
	});
});

test("keeps partial pending progress available and omits fully approved periods and one-offs", () => {
	expect(buildEntries(makeTask({ cadenceTarget: 2, logs: [makeLog(NOW, "PENDING")] }))[0]).toMatchObject({
		state: "available",
		progress: 1,
	});
	for (const isRecurring of [true, false]) {
		expect(buildEntries(makeTask({ isRecurring, logs: [makeLog(NOW)] }))).toEqual([]);
	}
});

test("only current-period pending completions produce an awaiting-approval row", () => {
	const previousPending = makeLog(new Date("2024-01-07T23:59:59.999Z"), "PENDING");
	expect(buildEntries(makeTask({ logs: [previousPending] }))[0]).toMatchObject({
		state: "available",
		pendingCompleters: [],
		completedLastCycle: true,
	});
	expect(buildEntries(makeTask({ logs: [previousPending, makeLog(NOW)] }))).toEqual([]);
});

// These eligibility cases previously lived in weekViewTimeline.test.ts. To do
// now uses this single, range-independent derivation for the dashboard and hub.
test("keeps unfinished one-offs regardless of how long ago they were assigned", () => {
	const task = makeTask({ isRecurring: false, assignedAt: new Date("2023-01-01T00:00:00.000Z") });
	expect(buildEntries(task)[0]).toMatchObject({ id: task.id, state: "available", progress: 0 });
});

test("omits work before its assigned time and includes it at that exact time", () => {
	for (const isRecurring of [false, true]) {
		const task = makeTask({ isRecurring, assignedAt: new Date(NOW.getTime() + 1) });
		expect(buildEntries(task)).toEqual([]);
		expect(buildEntries(task, task.assignedAt)[0]?.state).toBe("available");
	}
});

test("includes a new recurring task in a partial calendar period with its preset metadata", () => {
	const assignedAt = new Date("2024-01-03T14:30:00.000Z");
	const task = makeTask({ assignedAt, preset: { id: "preset", label: "Mop floors", bucket: "ROUTINE" } });
	expect(buildEntries(task, new Date("2024-01-04T09:00:00.000Z"))[0]).toMatchObject({
		assignedAt: assignedAt.toISOString(),
		label: "Mop floors",
		bucket: "ROUTINE",
		points: getBucketPoints("ROUTINE"),
		state: "available",
		nextResetAt: NOW.toISOString(),
	});
});

test("uses only the current calendar period, including a week crossing a month boundary", () => {
	const now = new Date("2024-05-02T09:00:00.000Z");
	const previousLog = makeLog(new Date("2024-04-28T12:00:00.000Z"));
	const currentLog = makeLog(new Date("2024-04-30T12:00:00.000Z"));
	const task = makeTask({ logs: [previousLog, currentLog], cadenceTarget: 2 });
	expect(buildEntries(task, now)[0]).toMatchObject({
		progress: 1,
		state: "available",
		nextResetAt: "2024-05-06T00:00:00.000Z",
	});
	expect(buildEntries({ ...task, cadenceTarget: 1 }, now)).toEqual([]);
});

test("selected member grouping is separate from viewer-relative confirmation", () => {
	const tasks = [
		makeTask(),
		makeTask({ id: "sam", assignedTo: { id: "sam", name: "Sam", email: null } }),
		makeTask({ id: "open", assignedTo: null }),
	];
	expect(
		buildAssignedTaskEntries({ tasks, userId: "viewer", groupRelativeToUserId: "sam", now: NOW, timeZone: TIME_ZONE }),
	).toMatchObject([
		{ group: "others", assignedToOther: false },
		{ group: "mine", assignedToOther: true },
		{ group: "open", assignedToOther: false },
	]);
});
