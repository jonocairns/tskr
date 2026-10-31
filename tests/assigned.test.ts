import { buildAssignedTaskEntries } from "@/lib/dashboard/assigned";
import { getBucketPoints } from "@/lib/points";

type AssignedTaskRecord = Parameters<typeof buildAssignedTaskEntries>[0]["tasks"][number];

const TIME_ZONE = "UTC";
const NOW = new Date("2024-01-08T00:00:00.000Z");

const makeTask = (overrides: Partial<AssignedTaskRecord> = {}) => ({
	id: "task-1",
	assignedAt: new Date("2024-01-01T00:00:00.000Z"),
	status: "ACTIVE",
	cadenceTarget: 1,
	cadenceIntervalMinutes: 10080,
	isRecurring: true,
	preset: { id: "preset-1", label: "Vacuum", bucket: "QUICK" },
	logs: [],
	...overrides,
});

const buildEntries = (task: AssignedTaskRecord, now = NOW, timeZone = TIME_ZONE) =>
	buildAssignedTaskEntries({ tasks: [task], now, timeZone });

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
	const task = makeTask({ logs: [{ createdAt: completedAt }] });
	expect(buildEntries(task, completedAt)).toEqual([]);
	expect(buildEntries(task)).toMatchObject([
		{ progress: 0, completedLastCycle: true, lastCompletedAt: completedAt.toISOString() },
	]);
});

test("does not tag partial progress or a completion from an older cycle as completed last cycle", () => {
	const logs = [{ createdAt: new Date("2024-01-07T23:30:00.000Z") }];
	expect(buildEntries(makeTask({ logs, cadenceTarget: 2 }))[0]?.completedLastCycle).toBe(false);
	expect(buildEntries(makeTask({ logs }), new Date("2024-01-15T00:00:00.000Z"))[0]).toMatchObject({
		completedLastCycle: false,
		lastCompletedAt: logs[0].createdAt.toISOString(),
	});
});

test("keeps previous-cycle acknowledgement while showing current-cycle progress", () => {
	const logs = [
		{ createdAt: new Date("2024-01-07T12:00:00.000Z") },
		{ createdAt: new Date("2024-01-07T23:30:00.000Z") },
		{ createdAt: NOW },
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
	const task = makeTask({ cadenceIntervalMinutes: 1440, logs: [{ createdAt: completedAt }] });
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
	expect(buildEntries(makeTask({ isRecurring: false, logs: [{ createdAt: NOW }] }))).toEqual([]);
});
